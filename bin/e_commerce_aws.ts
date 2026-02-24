#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ProductsAppStack } from '../lib/products_app-stack';
import { ECommerceApiGateway } from '../lib/ecommerce_apigateway-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: "367088349328",
  region: "us-east-1"
}

const tags = {
  cost: "ECommerce",
  team: "CursoAws"
}

const productsAppStack = new ProductsAppStack(app, "ProductsAppStack", {
  tags,
  env
})

const eCommerceApiStack = new ECommerceApiGateway(app, "ECommerceApi", {
  productsFetchHandler: productsAppStack.productsFetchHandler,
  tags,
  env
})

eCommerceApiStack.addDependency(productsAppStack)