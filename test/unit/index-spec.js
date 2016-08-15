/* jshint node:true, expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _index = require('../../src/index');

describe('_index', () => {
    describe('[handlers]', () => {
       it('should define the expected handlers', () => {
           expect(_index.greetingHandler).to.be.a('function');
       }); 
    });
});
