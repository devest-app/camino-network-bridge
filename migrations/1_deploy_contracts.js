const Helper = require("../test/helpers/Helper");

const DvBridge = artifacts.require("DvBridge");
const ERC20PresetFixedSupply = artifacts.require("ERC20PresetFixedSupply");

// zero address
const zeroAddress = '0x0000000000000000000000000000000000000000';

module.exports = function(deployer) {
    if (deployer.network === 'development') {
        deployer.deploy(DvBridge, 123, zeroAddress, [Helper.publicAddress1, Helper.publicAddress2, Helper.publicAddress3])
            .then(async _instance => {})
            .then(() => DvBridge.deployed())
    } else {
      deployer.deploy(DvBridgeFactory)
          .then(() => DvBridgeFactory.deployed())
          .then(async _instance => {
              //await _instance.setFee(10000000);
          });
  }
};
