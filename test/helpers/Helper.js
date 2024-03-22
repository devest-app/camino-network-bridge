const ERC20 = artifacts.require("ERC20PresetFixedSupply");
const web3 = require('web3');

class Helper {

    static privateKey1 = "222448da4964a3c5e80b5fbce76d458bbb2ec9a6fa8930298c7c02cb0ece7776";
    static publicAddress1 = "0xFe84dFC77D747512cBaE15B6af042886d4329d82";
    
    static privateKey2 = "e651b3defe47e955eff21b553542dfc173619876071ee98fad9272c45af54656";
    static publicAddress2 = "0x34b9e58EA19695DDdc3bF71edBA9Bf8F1F8227C2";

    static privateKey3 = "460662364e0016741948d0a64eb08905792f5484ef0c962d0d018837c23f1af7";
    static publicAddress3 = "0x4C47ddDa6cc8618290F0bFf7a66bDB27677e81eE";

    static chainID = 123;

    
    static async setupAccountFunds(accounts, erc20Token, amount) {
        const account = accounts[0];

        // Make transaction from first account to second.
        for (let i = 2; i < 10; i++) {
            await erc20Token.transfer(accounts[i], amount, { from: account });
        }

        // Get balances of first and second account after the transactions.
        const accountOneEndingBalance = (await erc20Token.balanceOf.call(account)).toNumber();

        // send back
        assert.equal(accountOneEndingBalance, 680000000000, "Failed to transfer funds");
    }
}

module.exports = Helper;
