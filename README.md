# AWS CDK – Projeto ECommerce com TypeScript

Este projeto utiliza o **AWS CDK (Cloud Development Kit)** com **TypeScript** para definir e provisionar infraestrutura na AWS como código (Infrastructure as Code).

---

## Pré-requisitos

- Node.js (LTS)
- AWS CLI instalada
- AWS CDK instalado globalmente

Instalar o CDK globalmente:

```bash
npm install -g aws-cdk
```

## Configuração da AWS

Configure suas credenciais antes de realizar qualquer deploy:

```bash
aws configure
```

## Comandos principais (CDK)
``` bash
cdk list              # Lista as stacks
cdk synth             # Gera o template CloudFormation
cdk diff              # Mostra diferenças antes do deploy
cdk deploy --all      # Cria/atualiza os recursos
cdk destroy --all     # Remove as stacks criadas
```