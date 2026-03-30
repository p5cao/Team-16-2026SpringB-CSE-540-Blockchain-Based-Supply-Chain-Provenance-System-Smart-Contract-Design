import { expect } from "chai";
import hre from "hardhat";

const { ethers, networkHelpers } = await hre.network.connect();

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
    const [admin, producer, distributor, retailer, consumer] =
      await ethers.getSigners();

    const contract = await ethers.deployContract("SupplyChainProvenance");
    await contract.waitForDeployment();

    return {
      contract,
      admin,
      producer,
      distributor,
      retailer,
      consumer,
    };
  }

  async function deployWithRolesFixture() {
    const { contract, admin, producer, distributor, retailer, consumer } =
      await networkHelpers.loadFixture(deployFixture);

    await contract.connect(admin).assignRole(await producer.getAddress(), Role.Producer);
    await contract.connect(admin).assignRole(await distributor.getAddress(), Role.Distributor);
    await contract.connect(admin).assignRole(await retailer.getAddress(), Role.Retailer);
    await contract.connect(admin).assignRole(await consumer.getAddress(), Role.Consumer);

    return {
      contract,
      admin,
      producer,
      distributor,
      retailer,
      consumer,
    };
  }

  it("should deploy successfully and set deployer as admin", async function () {
    const { contract, admin } = await networkHelpers.loadFixture(deployFixture);

    expect(await contract.admin()).to.equal(await admin.getAddress());
    expect(await contract.rolesMapping(await admin.getAddress())).to.equal(Role.Admin);
  });

  it("should allow admin to assign roles", async function () {
    const { contract, admin, producer, distributor } =
      await networkHelpers.loadFixture(deployFixture);

    await contract.connect(admin).assignRole(await producer.getAddress(), Role.Producer);
    await contract.connect(admin).assignRole(await distributor.getAddress(), Role.Distributor);

    expect(await contract.rolesMapping(await producer.getAddress())).to.equal(Role.Producer);
    expect(await contract.rolesMapping(await distributor.getAddress())).to.equal(Role.Distributor);
  });

  it("should allow producer to create a product", async function () {
    const { contract, producer } =
      await networkHelpers.loadFixture(deployWithRolesFixture);

    await contract
      .connect(producer)
      .createProduct(1, 1001, "QmProducerBatch001", 1893456000);

    const product = await contract.productLedger(1);

    expect(product.prodId).to.equal(1n);
    expect(product.producer).to.equal(await producer.getAddress());
    expect(product.producerBatchId).to.equal(1001n);
    expect(product.ipfsHash).to.equal("QmProducerBatch001");
    expect(product.currentStatus).to.equal(ProductStatus.InProduction);
    expect(product.currentOwner).to.equal(await producer.getAddress());
  });

  it("should allow distributor to receive product at warehouse after producer marks it ready", async function () {
    const { contract, producer, distributor } =
      await networkHelpers.loadFixture(deployWithRolesFixture);

    await contract
      .connect(producer)
      .createProduct(1, 1001, "QmProducerBatch001", 1893456000);

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
});