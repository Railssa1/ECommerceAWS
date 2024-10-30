import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { ApiGatewayManagementApi, DynamoDB, S3 } from "aws-sdk";
import * as AWSXRay from "aws-xray-sdk";
import { v4 as uuid} from "uuid";
import { InvoiceTransactionRepository, InvoiceTransactionStatus } from "./layers/invoiceTransaction/nodejs/invoiceTransaction";
import { InvoiceWSService } from "./layers/invoiceWSConnection/nodejs/invoiceWSConnection";

AWSXRay.captureAWS(require("aws-sdk"));

const invoicesDdb = process.env.INVOICE_DDB!;
const bucketName = process.env.BUCKET_NAME!;
const invoiceWsApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6);

const s3Client = new S3();
const ddbClient = new DynamoDB.DocumentClient();
const apiGatewayManagementApi = new ApiGatewayManagementApi({
    endpoint: invoiceWsApiEndpoint
});
const invoiceTransactionRepository = new InvoiceTransactionRepository(ddbClient, invoicesDdb)
const invoiceWSService = new InvoiceWSService(apiGatewayManagementApi);
export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    console.log(event);
    
    const lambdaRequestId = context.awsRequestId;
    const connectionId = event.requestContext.connectionId!;

    console.log(`ConnectionId: ${connectionId} - Lambda Request id: ${lambdaRequestId}`)

    const key = uuid();
    const expires = 300;
    const signedUrlPut = await s3Client.getSignedUrlPromise('putObject', {
        Bucket: bucketName,
        Key: key,
        Expires: expires
    });

    // Create invoice transaction
    const timestamp = Date.now();
    const ttl = ~~~(timestamp / 1000 +  60 * 2);
    await invoiceTransactionRepository.createInvoiceTransaction({
        pk: "#transaction",
        sk: key,
        ttl: ttl,
        requestId: lambdaRequestId,
        transactionStatus: InvoiceTransactionStatus.GENERATED,
        expiresIn: expires,
        connectionId: connectionId,
        endpoint: invoiceWsApiEndpoint,
        timestamp: timestamp
    });

    // Send url back to WS connected client
    const postData = JSON.stringify({
        url: signedUrlPut,
        expires: expires,
        transactionId: key,
    });
    await invoiceWSService.sendData(connectionId, postData);
    
    return {
        statusCode: 200,
        body: 'OK'
    }
}