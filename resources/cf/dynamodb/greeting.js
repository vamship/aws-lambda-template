'use strict';

const Environment = require('wysknd-aws-lambda').Environment;
const DynamoDbTemplates = require('wysknd-aws-cf-generator').DynamoDbTemplates;
const TableTemplate = DynamoDbTemplates.TableTemplate;
const LocalSecondaryIndex = DynamoDbTemplates.LocalSecondaryIndex;
const GlobalSecondaryIndex = DynamoDbTemplates.GlobalSecondaryIndex;

/**
 * Returns the table definition for the greetings table.
 */
module.exports = (dirInfo) => {

    return ['dev'].map((envName) => {
        const env = new Environment(envName);
        const tableName = env.getSuffixString('greeter.greetings');
        const key = dirInfo.getToken(tableName);
        return (new TableTemplate(key, tableName))
            .addKey('userId', 'S', 'HASH')
            .addKey('timestamp', 'N', 'RANGE')
            .setReadCapacity(5)
            .setWriteCapacity(5)
            .addLocalSecondaryIndex(
                (new LocalSecondaryIndex('userId-status-index'))
                .addKey('userId', 'S', 'HASH')
                .addKey('status', 'S', 'RANGE')
                .setProjectionType('INCLUDE')
                .addNonKeyAttribute('text')
            );
    });
};
