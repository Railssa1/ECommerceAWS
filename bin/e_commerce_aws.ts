#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { ECommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductAppLayersStack } from '../lib/productsAppLayers-stack';

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

const productsAppStack = new ProductsAppStack(app, "ProductsApp", {
  tags,
  env
});
productsAppStack.addDependency(productsAppLayersStack);

const eCommerceApiStack = new ECommerceApiStack(app, "ECommerceApi", {
  tags,
  env,
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler
});

eCommerceApiStack.addDependency(productsAppStack);