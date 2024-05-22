const DvBridge = artifacts.require("DvBridge");

module.exports = function(deployer) {
  if (deployer.network === 'development') {
      deployer.deploy(DvBridge, 123, zeroAddress, [Helper.publicAddress1, Helper.publicAddress2, Helper.publicAddress3])
          .then(() => DvBridge.deployed())
          .then(async _instance => {
                await _instance.setFee(0, 0);
          });
  } else {
      deployer.deploy(DvBridge)
          .then(() => DvBridge.deployed())
          .then(async _instance => {
              await _instance.setFee(0, 0);
          });
  }
};
