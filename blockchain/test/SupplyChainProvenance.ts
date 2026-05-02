import { expect } from "chai";
import hre from "hardhat";

const { ethers, networkHelpers } = await hre.network.connect();
const { loadFixture } = networkHelpers;

describe("SupplyChainProvenance", function () {
  const Role = {
    UnRegistered: 0n,
    Producer: 1n,
    Consumer: 2n,
    Distributor: 3n,
    Retailer: 4n,
    Admin: 5n,
    Auditor: 6n,
  };

  const ProductStatus = {
    InProduction: 0n,
    ReadyToShip: 1n,
    InTransitToWarehouse: 2n,
    ShippedToWarehouse: 3n,
    WHQualityCheckPassed: 4n,
    ReturnedToProducer: 5n,
    InWarehouse: 6n,
    InTransitToRetailer: 7n,
    ShippedToRetailer: 8n,
    RetailerQualityCheckPassed: 9n,
    RetailerReturnedToWarehouse: 10n,
    InStore: 11n,
    Sold: 12n,
  };

  async function deployFixture() {
    const [admin, producer, distributor, retailer, consumer] = await ethers.getSigners();
    const contract: any = await ethers.deployContract("SupplyChainProvenance");
    await contract.waitForDeployment();
    return { contract, admin, producer, distributor, retailer, consumer };
  }

  async function deployWithRolesFixture() {
    const { contract, admin, producer, distributor, retailer, consumer } = await loadFixture(deployFixture);
    await contract.connect(admin).assignRole(await producer.getAddress(), Role.Producer);
    await contract.connect(admin).assignRole(await distributor.getAddress(), Role.Distributor);
    await contract.connect(admin).assignRole(await retailer.getAddress(), Role.Retailer);
    await contract.connect(admin).assignRole(await consumer.getAddress(), Role.Consumer);
    return { contract, admin, producer, distributor, retailer, consumer };
  }

  it("should deploy successfully and set deployer as admin", async function () {
    const { contract, admin } = await loadFixture(deployFixture);

    expect(await contract.admin()).to.equal(await admin.getAddress());
    expect(await contract.rolesMapping(await admin.getAddress())).to.equal(Role.Admin);
  });

  it("should allow admin to assign roles", async function () {
    const { contract, admin, producer, distributor } =
      await loadFixture(deployFixture);

    await contract.connect(admin).assignRole(await producer.getAddress(), Role.Producer);
    await contract.connect(admin).assignRole(await distributor.getAddress(), Role.Distributor);

    expect(await contract.rolesMapping(await producer.getAddress())).to.equal(Role.Producer);
    expect(await contract.rolesMapping(await distributor.getAddress())).to.equal(Role.Distributor);
  });

  it("should allow producer to create a product", async function () {
    const { contract, producer } =
      await loadFixture(deployWithRolesFixture);

    await contract
      .connect(producer)
      .createProduct(1, "QmProducerBatch001");

    const product = await contract.productLedger(1);

    expect(product.prodId).to.equal(1n);
    expect(product.ipfsHash).to.equal("QmProducerBatch001");
    expect(product.currentStatus).to.equal(ProductStatus.InProduction);
    expect(product.currentOwner).to.equal(await producer.getAddress());
  });

  it("should allow distributor to receive product at warehouse after producer marks it ready", async function () {
    const { contract, producer, distributor } =
      await loadFixture(deployWithRolesFixture);

    await contract
      .connect(producer)
      .createProduct(1, "QmProducerBatch001");

    await contract
      .connect(producer)
      .markReadyToShip(1, "QmReadyToShip001");

    await contract
      .connect(distributor)
      .receiveAtWarehouse(1, "QmWarehouseReceipt001");

    const product = await contract.productLedger(1);

    expect(product.currentOwner).to.equal(await distributor.getAddress());
    expect(product.currentStatus).to.equal(ProductStatus.ShippedToWarehouse);
    expect(product.ipfsHash).to.equal("QmWarehouseReceipt001");
  });

  /**
   * Full chain: producer → distributor warehouse → retailer → in-store → consumer purchase.
   */
  async function productInStoreFixture() {
    const ctx = await loadFixture(deployWithRolesFixture);
    const { contract, producer, distributor, retailer, consumer } = ctx;
    const prodId = 42n;
    await contract.connect(producer).createProduct(prodId, "QmProducerBatch001");
    await contract.connect(producer).markReadyToShip(prodId, "QmReady");
    await contract.connect(distributor).receiveAtWarehouse(prodId, "QmRecv");
    await contract.connect(distributor).passWarehouseQualityCheck(prodId, "QmWHQC");
    await contract.connect(distributor).storeInWarehouse(prodId, "QmStock");
    await contract.connect(distributor).shipToRetailer(prodId, await retailer.getAddress(), "QmShip");
    await contract.connect(retailer).retailerReceiveProduct(prodId, "QmRetailRecv");
    await contract.connect(retailer).placeInStore(prodId, "QmInStore");
    return { ...ctx, prodId };
  }

  it("should allow consumer to verify product (same as getProduct)", async function () {
    const { contract, producer } = await loadFixture(deployWithRolesFixture);

    await contract
      .connect(producer)
      .createProduct(9, "QmA");

    const v = await contract.verifyProduct(9);
    const g = await contract.getProduct(9);
    expect(v.prodId).to.equal(g.prodId);
    expect(v.ipfsHash).to.equal("QmA");
  });

  it("should allow consumer to purchase after product is in store", async function () {
    const { contract, retailer, consumer, prodId } = await loadFixture(
      productInStoreFixture
    );

    await contract.connect(consumer).purchaseProduct(prodId, "QmSaleReceipt");

    const product = await contract.productLedger(prodId);
    expect(product.currentStatus).to.equal(ProductStatus.Sold);
    expect(product.currentOwner).to.equal(await consumer.getAddress());
    expect(product.ipfsHash).to.equal("QmSaleReceipt");
    expect(await contract.rolesMapping(await retailer.getAddress())).to.equal(Role.Retailer);
  });

  it("should reject purchase if caller is not Consumer", async function () {
    const { contract, producer, prodId } = await loadFixture(productInStoreFixture);

    await expect(
      contract.connect(producer).purchaseProduct(prodId, "QmX")
    ).to.be.revertedWith("Caller does not have the required role");
  });

  it("should reject purchase if product is not in store", async function () {
    const { contract, consumer, producer } = await loadFixture(deployWithRolesFixture);

    await contract
      .connect(producer)
      .createProduct(99, "QmA");
    await contract.connect(producer).markReadyToShip(99, "QmR");

    await expect(
      contract.connect(consumer).purchaseProduct(99, "QmX")
    ).to.be.revertedWith("Product is not available for sale in store");
  });
});