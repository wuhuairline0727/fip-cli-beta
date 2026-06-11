const { expect } = require('chai');
const sinon = require('sinon');
const http = require('http');

describe('utils/table', () => {
  let httpRequestStub;
  let table;

  beforeEach(() => {
    httpRequestStub = sinon.stub(http, 'request').callsFake((options, callback) => {
      const req = {
        write: sinon.stub(),
        end: sinon.stub(),
        destroy: sinon.stub(),
        on: sinon.stub().callsFake((event, handler) => {
          if (event === 'error') {
            setImmediate(() => handler(new Error('connect ECONNREFUSED 127.0.0.1:10086')));
          }
          return req;
        }),
      };
      return req;
    });
    delete require.cache[require.resolve('../../../lib/browser')];
    delete require.cache[require.resolve('../../../lib/utils/table')];
    table = require('../../../lib/utils/table');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should export getTableData function', () => {
    expect(table.getTableData).to.be.a('function');
  });
});
