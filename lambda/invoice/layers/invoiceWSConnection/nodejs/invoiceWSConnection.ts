import { ApiGatewayManagementApi } from "aws-sdk";

export class InvoiceWSService {
    private apigatewayManagementApi: ApiGatewayManagementApi;

    constructor(apigatewayManagementApi: ApiGatewayManagementApi) {
        this.apigatewayManagementApi = apigatewayManagementApi;
    }

    sendInvoiceStatus(transactionId: string, connectionId: string, status: string) {
        const postData = JSON.stringify({
            transactionId: transactionId,
            status: status
        });

        return this.sendData(connectionId, postData)
    }

    async disconnectClient(connectionId: string): Promise<boolean> {
        try {
            await this.apigatewayManagementApi.getConnection({
                ConnectionId: connectionId
            }).promise();

            await this.apigatewayManagementApi.deleteConnection({
                ConnectionId: connectionId
            }).promise();
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    async sendData(connectionId: string, data: string): Promise<boolean> {
        try {
            await this.apigatewayManagementApi.getConnection({
                ConnectionId: connectionId
            }).promise();

            await this.apigatewayManagementApi.postToConnection({
                ConnectionId: connectionId,
                Data: data
            }).promise();
            return true;
        } catch (err) {
            console.log(err);
            return false;
        }
    }
}