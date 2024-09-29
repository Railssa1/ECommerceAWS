import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB, Lambda } from "aws-sdk";
import { ProductEvent, ProductEventType } from "/opt/nodejs/productEventsLayer";
import * as AWSXRay from "aws-xray-sdk";

AWSXRay.captureAWS(require("aws-sdk"));

const productDdb = process.env.PRODUCTS_DDB!;
const productEventsFunctionName = process.env.PRODUCT_EVENTS_FUNCTION_NAME!;
const ddbClient = new DynamoDB.DocumentClient();
const lambdaClient = new Lambda();

const productRepository = new ProductRepository(ddbClient, productDdb);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const method = event.httpMethod;

    const lambdaRequestId = context.awsRequestId;
    const apiRequestId = event.requestContext.requestId;

    console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`);

    if (event.resource === "/products") {
        console.log("[POST] /products");
        const product = JSON.parse(event.body!) as Product;
        const productCreated = await productRepository.createProduct(product);

        const response = await sendProductEvent(productCreated, ProductEventType.CREATED, "raissa", lambdaRequestId);
        console.log(response);

        return {
            statusCode: 201,
            body: JSON.stringify(productCreated)
        };
    } else if (event.resource === "/products/{id}") {
        const productId = event.pathParameters!.id as string;

        if (method === "PUT") {
            console.log(`[PUT] /products/${productId}`);

            try {
                const product = JSON.parse(event.body!) as Product;
                const productUpdate = await productRepository.updateProduct(productId, product);

                const response = await sendProductEvent(productUpdate, ProductEventType.UPDATE, "raissa", lambdaRequestId);
                console.log(response);

                return {
                    statusCode: 200,
                    body: JSON.stringify(productUpdate)
                };
            } catch (ConditionalCheckFailedException) {
                return {
                    statusCode: 404,
                    body: "Product not found"
                }
            }
        } else if (method === "DELETE") {
            console.log(`[DELETE] /products/${productId}`);

            try {
                const productDeleted = await productRepository.deleteProduct(productId);

                const response = await sendProductEvent(productDeleted, ProductEventType.DELETED, "raissa", lambdaRequestId);
                console.log(response);

                return {
                    statusCode: 200,
                    body: JSON.stringify(productDeleted)
                };
            } catch (error) {
                console.error((<Error>error).message);
                return {
                    statusCode: 404,
                    body: (<Error>error).message
                }
            }
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "Bad request"
        })
    }
}

function sendProductEvent(product: Product, eventType: ProductEventType, email: string, lambdaRequestId: string) {
    const event: ProductEvent = {
        email: email,
        eventType: eventType,
        productCode: product.code,
        productId: product.id,
        productPrice: product.price,
        requestId: lambdaRequestId
    };

    return lambdaClient.invoke({
        FunctionName: productEventsFunctionName,
        Payload: JSON.stringify(event),
        InvocationType: "Event"
    }).promise();
}