import { DocumentClient } from "aws-sdk/clients/dynamodb";

export interface OrderProduct {
    code: string;
    price: number;
}

export interface Order {
    pk: string;
    sk: string;
    createdAt: number;
    shipping: {
        type: "URGENT" | "ECONOMIC",
        carrier: "CORREIOS" | "SEDEX"
    },
    billing: {
        payment: "CASH" | "DEBIT_CARD" | "CREDIT_CARD",
        totalPrice: number
    },
    products: OrderProduct[]
}

export class OrderRepository {
    private ddbClient: DocumentClient;
    private ordersDdb: string;

    constructor(ddbClient: DocumentClient, orderDdb: string) {
        this.ddbClient = ddbClient;
        this.ordersDdb = orderDdb;
    }

    async createOrder(order: Order): Promise<Order> {
        await this.ddbClient.put({
            TableName: this.ordersDdb,
            Item: order
        }).promise();

        return order;
    }

    async getAllOrders(): Promise<Order[]> {
        const orders = await this.ddbClient.scan({
            TableName: this.ordersDdb
        }).promise();

        return orders.Items as Order[];
    }

    async getOrdersByEmail(email: string): Promise<Order[]> {
        const orders = await this.ddbClient.query({
            TableName: this.ordersDdb,
            KeyConditionExpression: "pk = :email",
            ExpressionAttributeValues: {
                ":email": email
            }
        }).promise();

        return orders.Items as Order[];
    }

    async getOrder(email: string, orderId: string): Promise<Order> {
        const order = await this.ddbClient.get({
            TableName: this.ordersDdb,
            Key: {
                pk: email,
                sk: orderId
            }
        }).promise();

        if (order.Item)
            return order.Item as Order;

        throw new Error("Order not found");
    }

    async deleteOrder(email: string, orderId: string): Promise<Order> {
        const order = await this.ddbClient.delete({
            TableName: this.ordersDdb,
            Key: {
                pk: email,
                sk: orderId
            },
            ReturnValues: "ALL_OLD"
        }).promise();

        if (order.Attributes)
            return order.Attributes as Order;

        throw new Error("Order not found");
    }
}
