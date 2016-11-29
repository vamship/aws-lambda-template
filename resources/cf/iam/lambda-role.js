'use strict';

const IamTemplates = require('wysknd-aws-cf-generator').IamTemplates;
const RoleTemplate = IamTemplates.RoleTemplate;
const PolicyDocument = IamTemplates.PolicyDocument;
const PolicyStatement = IamTemplates.PolicyStatement;

module.exports = (dirInfo) => {
    const roleName = 'sample.lambda_role';
    const key = dirInfo.getRootToken(roleName);

    return new RoleTemplate(key, roleName)
        .addAwsManagedPolicy('AmazonDynamoDBFullAccess')
        .setAssumePolicy(
            (new PolicyDocument())
            .addStatement((new PolicyStatement())
                .addAction('sts:AssumeRole')
                .addServicePrincipal('lambda.amazonaws.com'))
        );
};
