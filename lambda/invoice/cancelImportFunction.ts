import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk";
import { InvoiceTransactionRepository, InvoiceTransactionStatus } from "/opt/nodejs/invoiceTransaction";
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection";
import { DynamoDB, ApiGatewayManagementApi } from "aws-sdk";

AWSXRay.captureAWS(require("aws-sdk"));

const invoicesDdb = process.env.INVOICE_DDB!;
const invoiceWsApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6);

const ddbClient = new DynamoDB.DocumentClient();
const apiGatewayManagementApi = new ApiGatewayManagementApi({
    endpoint: invoiceWsApiEndpoint
});

const invoiceTransactionRepository = new InvoiceTransactionRepository(ddbClient, invoicesDdb)
const invoiceWSService = new InvoiceWSService(apiGatewayManagementApi);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const transactionId = JSON.parse(event.body!).transactionId as string;
    const lambdaRequestId = context.awsRequestId;
    const connectionId = event.requestContext.connectionId!;

    console.log(`ConnectionId: ${connectionId} - Lambda Request id: ${lambdaRequestId}`);

    try {
        const invoiceTransaction = await invoiceTransactionRepository.getInvoiceTransaction(transactionId);
        if (invoiceTransaction.transactionStatus === InvoiceTransactionStatus.GENERATED) {
            await Promise.all([
                invoiceWSService.sendInvoiceStatus(transactionId, invoiceTransaction.connectionId, InvoiceTransactionStatus.CANCELLED),
                invoiceTransactionRepository.updateInvoiceTransaction(transactionId, InvoiceTransactionStatus.CANCELLED)
            ]);
        } else {
            await invoiceWSService.sendInvoiceStatus(transactionId, invoiceTransaction.connectionId, invoiceTransaction.transactionStatus);
            console.error(`Can't cancel an ongoing process`);
        }

    } catch (error) {
        console.error((<Error>error).message);
        console.log(`Invoice transaction not found - TransactionId: ${transactionId}`);
        await invoiceWSService.sendInvoiceStatus(transactionId, connectionId, InvoiceTransactionStatus.NOT_FOUND);
    }

    await invoiceWSService.disconnectClient(connectionId)

    return {
        statusCode: 200,
        body: 'OK'
    }
}