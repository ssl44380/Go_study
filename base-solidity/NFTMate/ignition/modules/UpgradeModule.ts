import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import nftAuctionModule from "./ProxyModule.js";


const upgradeModule = buildModule("UpgradeModule", (m) => {

    const proxyAdminOwner = m.getAccount(1);
    
    const {proxy,proxyAdmin} =m.useModule(nftAuctionModule);


    const auctionV2 = m.contract("MetaNFTAuctionV2");

    m.call(proxyAdmin,"upgradeAndCall",[proxy, auctionV2, "0x"],{
        from:proxyAdminOwner
    })

    return { proxyAdmin, proxy };
})


const nftAuctionV2Module = buildModule("nftAuctionV2Module", (m) => {

  const { proxy } = m.useModule(upgradeModule);

  const auctionV2 = m.contractAt("MetaNFTAuctionV2", proxy);

  return { auctionV2 };
});

export default nftAuctionV2Module;