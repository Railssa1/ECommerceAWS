#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { ECommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductAppLayersStack } from '../lib/productsAppLayers-stack';
import { EventsDdbStack } from '../lib/eventsDdb-stack';
import { OrdersAppLayersStack } from '../lib/ordersAppLayers-stack';
import { OrdersAppStack } from '../lib/ordersApp-stack';
import { InvoiceWSApiStack } from '../lib/invoiceWSApi-stack';
import { InvoicesAppLayerStack } from '../lib/invoicesAppLayers-stack';

const app = new cdk.App();

// Variáveis de ambiente para definir número da conta e região
const env: cdk.Environment = {
  account: "590183705024",
  region: "us-east-1"
}

// E tags para rateio
const tags = {
  cost: "ECommerce",
  team: "Raissa"
}

const productsAppLayersStack = new ProductAppLayersStack(app, "ProductAppLayers", {
  tags,
  env
});

const eventsDdbStack = new EventsDdbStack(app, "EventsDdb", {
  tags,
  env,
});

const productsAppStack = new ProductsAppStack(app, "ProductsApp", {
  tags,
  env,
  eventsDdb: eventsDdbStack.table
});

productsAppStack.addDependency(productsAppLayersStack);
productsAppStack.addDependency(eventsDdbStack);

const ordersAppLayerStack = new OrdersAppLayersStack(app, "OrdersAppLayers", {
  tags,
  env
});

const ordersAppStack = new OrdersAppStack(app, "OrdersApp", {
  tags,
  env,
  productsDdb: productsAppStack.productsDdb,
  eventsDdb: eventsDdbStack.table
});
ordersAppStack.addDependency(productsAppStack);
ordersAppStack.addDependency(productsAppLayersStack);
ordersAppStack.addDependency(eventsDdbStack);

const eCommerceApiStack = new ECommerceApiStack(app, "ECommerceApi", {
  tags,
  env,
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  ordersHandler: ordersAppStack.ordersHandler,
  orderEventsFetchHandler: ordersAppStack.orderEventsFetchHandler
});

eCommerceApiStack.addDependency(productsAppStack);


const invoicesLayerStack = new InvoicesAppLayerStack(app, "InvoicesAppLayer", {
  tags: {
    cost: "InvoiceApp",
    team: "raissa"
  },
  env
});

const invoiceWSApiStack = new InvoiceWSApiStack(app, "InvoiceApi", {
  tags: {
    cost: "InvoiceApp",
    team: "raissa"
  },
  env
});

invoiceWSApiStack.addDependency(invoicesLayerStack);