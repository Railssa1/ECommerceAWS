import { InvoiceTransactionStatus } from './layers/invoiceTransaction/nodejs/invoiceTransaction';
import { Context, S3Event, S3EventRecord } from "aws-lambda";
import { S3, DynamoDB, ApiGatewayManagementApi } from "aws-sdk";
import * as AWSXRay from "aws-xray-sdk";
import { InvoiceTransactionRepository } from "/opt/nodejs/invoiceTransaction";
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection";
import { InvoiceFile, InvoiceRepository } from "/opt/nodejs/invoiceRepository";

AWSXRay.captureAWS(require("aws-sdk"));

const invoicesDdb = process.env.INVOICE_DDB!;
const invoiceWsApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6);

const s3Client = new S3();
const ddbClient = new DynamoDB.DocumentClient();
const apiGatewayManagementApi = new ApiGatewayManagementApi({
    endpoint: invoiceWsApiEndpoint
});

const invoiceTransactionRepository = new InvoiceTransactionRepository(ddbClient, invoicesDdb)
const invoiceWSService = new InvoiceWSService(apiGatewayManagementApi);
const invoiceRepository = new InvoiceRepository(ddbClient, invoicesDdb);

export async function handler(event: S3Event, context: Context): Promise<void> {
    console.log(event);
    const promises: Promise<void>[] = [];

    event.Records.forEach((record) => {
        promises.push(processRecord(record))
    });

    await Promise.all(promises);

    return;
}

async function processRecord(record: S3EventRecord): Promise<void> {
    const key = record.s3.object.key;

    try {
        const invoiceTransaction = await invoiceTransactionRepository.getInvoiceTransaction(key);
        if (invoiceTransaction.transactionStatus === InvoiceTransactionStatus.GENERATED) {
            await Promise.all(
                [
                    invoiceWSService.sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.RECEIVED),
                    invoiceTransactionRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.RECEIVED)
                ]
            );
        } else {
            await invoiceWSService.sendInvoiceStatus(key, invoiceTransaction.connectionId, invoiceTransaction.transactionStatus);
            console.error(`Non valid transaction status`);
            return;
        }

        const object = await s3Client.getObject({
            Key: key,
            Bucket: record.s3.bucket.name
        }).promise();

        const invoice = JSON.parse(object.Body!.toString('utf-8')) as InvoiceFile;
        console.log(invoice);

        const createInvoicePromise = invoiceRepository.create({
            pk: `#invoice_${invoice.customerName}`,
            sk: invoice.invoiceNumber,
            ttl: 0,
            totalValue: invoice.totalValue,
            productId: invoice.productId,
            quantity: invoice.quantity,
            transactionId: key,
            createdAt: Date.now()
        });

        const deleteObjectPromise = s3Client.deleteObject({
            Key: key,
            Bucket: record.s3.bucket.name
        }).promise();

        if(invoice.invoiceNumber.trim().length <= 5){
            console.error(`Invoice number invalid`);
            await Promise.all(
                [
                    invoiceWSService.sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.INVOICE_NUMBER_INVALID),
                    invoiceTransactionRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.INVOICE_NUMBER_INVALID),
                    invoiceWSService.disconnectClient(invoiceTransaction.connectionId)
                ]
            );
            return;
        } else {
            const updateInvoicePromise = invoiceTransactionRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.PROCESSED);
            const sendStatusPromise = invoiceWSService.sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.PROCESSED);
    
            await Promise.all([createInvoicePromise, deleteObjectPromise, updateInvoicePromise, sendStatusPromise]);
        }

    } catch (error) {
        console.log((<Error>error).message);
    }
}
