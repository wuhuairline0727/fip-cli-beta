import { expect } from 'chai';
import pkg from '../../package.json';

describe('FIP CLI Basic', () => {
  it('should load package.json', () => {
    expect(pkg).to.be.an('object');
    expect(pkg.name).to.equal('@wuhuairline0727/fip-cli');
  });

  it('should have required dependencies', () => {
    expect(pkg.dependencies).to.have.property('commander');
    expect(pkg.dependencies).to.have.property('chrome-remote-interface');
  });

  it('should have test scripts configured', () => {
    expect(pkg.scripts).to.have.property('test');
    expect(pkg.scripts).to.have.property('test:unit');
    expect(pkg.scripts.test).to.include('mocha');
  });
});
