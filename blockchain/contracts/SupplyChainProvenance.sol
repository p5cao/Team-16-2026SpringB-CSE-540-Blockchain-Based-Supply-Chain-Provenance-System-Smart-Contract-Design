/**
 * @notice CSE540project Team 16 Design Contract Draft
 * @notice Members: Pengcheng Cao, Yousef Majadbi, Tharindu Munasinghe, Shiyu Zhang, Minghao Zhao 
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title SupplyChainProvenance
 * @notice Draft smart contract for a blockchain-based supply chain provenance system.
 * @dev This draft focuses mainly on producer and distributor workflow.
 *      Retailer and consumer functions are included as placeholders for later development.
 */
contract SupplyChainProvenance {
    // Contract deployer acts as the system admin.
    address public admin;

    /**
     * @notice System roles used for access control.
     * UnRegistered is the default value for addresses not assigned by admin.
     */
    enum Role {
        UnRegistered,
        Producer,
        Consumer,
        Distributor,
        Retailer,
        Admin,
        Auditor
    }

    // Stores role assignment for each address.
    mapping(address => Role) public rolesMapping;

    /**
     * @notice Product lifecycle states used in the current design.
     * @dev The flow is intended to cover producer, warehouse/distributor,
     *      retailer, and final sale to consumer.
     */
    enum ProductStatus {
        InProduction,
        ReadyToShip,
        InTransitToWarehouse,
        ShippedToWarehouse,
        WHQualityCheckPassed,
        ReturnedToProducer,
        InWarehouse,
        InTransitToRetailer,
        ShippedToRetailer,
        RetailerQualityCheckPassed,
        RetailerReturnedToWarehouse,
        InStore,
        Sold
    }

    /**
     * @notice Product record stored on-chain.
     * @dev Only lightweight provenance data is stored on-chain.
     *      Detailed files and metadata are expected to remain off-chain,
     *      referenced by IPFS hash or similar content identifier.
     */
    struct Product {
        uint256 prodId;              // Unique product or batch ID
        address producer;            // Original producer
        uint256 producerBatchId;     // Producer-side batch reference
        string ipfsHash;             // Off-chain metadata pointer
        uint256 expirationDate;      // Optional expiration timestamp

        uint256 currentBatchId;      // Current batch ID after split/merge handling
        ProductStatus currentStatus; // Current lifecycle status
        address currentOwner;        // Current custodian / owner
        uint256 parentBatchId;       // Parent batch reference if derived from another batch
    }

    // Main on-chain ledger for product records.
    mapping(uint256 => Product) public productLedger;

    /************************************
     * Events
     ************************************/

    event RoleAssigned(address indexed user, Role role);

    event ProductCreated(
        uint256 indexed prodId,
        address indexed producer,
        string ipfsHash
    );

    event ProductStatusChanged(
        uint256 indexed prodId,
        ProductStatus newStatus,
        address indexed updatedBy,
        string ipfsHash
    );

    event ProductOwnershipTransferred(
        uint256 indexed prodId,
        address indexed previousOwner,
        address indexed newOwner
    );

    constructor() {
        admin = msg.sender;
        rolesMapping[msg.sender] = Role.Admin;
    }

    /************************************
     * Access Control
     ************************************/

    /**
     * @notice Restricts function access to admin only.
     */
    modifier adminOnly() {
        require(rolesMapping[msg.sender] == Role.Admin, "Only admin can call this function");
        _;
    }

    /**
     * @notice Restricts function access to one specific role.
     * @param _role Role required to call the function.
     */
    modifier onlyRole(Role _role) {
        require(rolesMapping[msg.sender] == _role, "Caller does not have the required role");
        _;
    }

    /**
     * @notice Checks whether a product record exists.
     * @param prodId Product ID to check.
     */
    modifier productExists(uint256 prodId) {
        require(productLedger[prodId].producer != address(0), "Product does not exist");
        _;
    }

    /************************************
     * User Management
     ************************************/

    /**
     * @notice Admin assigns a role to a user address.
     * @dev In the current draft, role assignment is controlled centrally by admin.
     * @param user Address of the user.
     * @param role Role to assign.
     */
    function assignRole(address user, Role role) public adminOnly {
        rolesMapping[user] = role;
        emit RoleAssigned(user, role);
    }

    /**
     * @notice Returns the role of a given address.
     * @param user Address to query.
     */
    function getRole(address user) public view returns (Role) {
        return rolesMapping[user];
    }

    /************************************
     * Producer Functions
     ************************************/

    /**
     * @notice Producer creates a new product or batch record.
     * @dev Initial status is set to InProduction, and producer becomes current owner.
     * @param prodId Unique product ID.
     * @param producerBatchId Producer-defined batch ID.
     * @param ipfsHash Off-chain metadata pointer.
     * @param expirationDate Expiration date if applicable.
     */
    function createProduct(
        uint256 prodId,
        uint256 producerBatchId,
        string memory ipfsHash,
        uint256 expirationDate
    ) public onlyRole(Role.Producer) {
        require(productLedger[prodId].producer == address(0), "Product already exists");

        productLedger[prodId] = Product({
            prodId: prodId,
            producer: msg.sender,
            producerBatchId: producerBatchId,
            ipfsHash: ipfsHash,
            expirationDate: expirationDate,
            currentBatchId: producerBatchId,
            currentStatus: ProductStatus.InProduction,
            currentOwner: msg.sender,
            parentBatchId: 0
        });

        emit ProductCreated(prodId, msg.sender, ipfsHash);
    }

    /**
     * @notice Producer marks a product as ready to ship.
     * @dev This is intended to represent the completion of production.
     * @param prodId Unique product ID.
     * @param ipfsHash Updated off-chain metadata pointer.
     */
    function markReadyToShip(
        uint256 prodId,
        string memory ipfsHash
    ) public onlyRole(Role.Producer) productExists(prodId) {
        Product storage product = productLedger[prodId];

        require(product.producer == msg.sender, "Only the producer can update this product");
        require(product.currentStatus == ProductStatus.InProduction, "Product is not in production");

        product.currentStatus = ProductStatus.ReadyToShip;
        product.ipfsHash = ipfsHash;

        emit ProductStatusChanged(prodId, ProductStatus.ReadyToShip, msg.sender, ipfsHash);
    }

    /************************************
     * Distributor Functions
     ************************************/

    /**
     * @notice Distributor receives product shipment from producer side.
     * @dev In this draft, receiving at warehouse transfers custody to distributor.
     * @param prodId Unique product ID.
     * @param ipfsHash Updated off-chain metadata pointer.
     */
    function receiveAtWarehouse(
        uint256 prodId,
        string memory ipfsHash
    ) public onlyRole(Role.Distributor) productExists(prodId) {
        Product storage product = productLedger[prodId];

        require(product.currentStatus == ProductStatus.ReadyToShip, "Product is not ready to ship");

        address previousOwner = product.currentOwner;
        product.currentOwner = msg.sender;
        product.currentStatus = ProductStatus.ShippedToWarehouse;
        product.ipfsHash = ipfsHash;

        emit ProductOwnershipTransferred(prodId, previousOwner, msg.sender);
        emit ProductStatusChanged(prodId, ProductStatus.ShippedToWarehouse, msg.sender, ipfsHash);
    }

    /**
     * @notice Distributor records warehouse quality check passed.
     * @dev This function represents warehouse intake inspection.
     * @param prodId Unique product ID.
     * @param ipfsHash Updated off-chain metadata pointer.
     */
    function passWarehouseQualityCheck(
        uint256 prodId,
        string memory ipfsHash
    ) public onlyRole(Role.Distributor) productExists(prodId) {
        Product storage product = productLedger[prodId];

        require(product.currentOwner == msg.sender, "Only current distributor can perform QC");
        require(
            product.currentStatus == ProductStatus.ShippedToWarehouse,
            "Product is not in warehouse receiving stage"
        );

        product.currentStatus = ProductStatus.WHQualityCheckPassed;
        product.ipfsHash = ipfsHash;

        emit ProductStatusChanged(prodId, ProductStatus.WHQualityCheckPassed, msg.sender, ipfsHash);
    }

    /**
     * @notice Distributor stores product in warehouse inventory.
     * @dev This step moves the product into warehouse stock after quality check.
     * @param prodId Unique product ID.
     * @param ipfsHash Updated off-chain metadata pointer.
     */
    function storeInWarehouse(
        uint256 prodId,
        string memory ipfsHash
    ) public onlyRole(Role.Distributor) productExists(prodId) {
        Product storage product = productLedger[prodId];

        require(product.currentOwner == msg.sender, "Only current distributor can store this product");
        require(
            product.currentStatus == ProductStatus.WHQualityCheckPassed,
            "Warehouse quality check must pass first"
        );

        product.currentStatus = ProductStatus.InWarehouse;
        product.ipfsHash = ipfsHash;

        emit ProductStatusChanged(prodId, ProductStatus.InWarehouse, msg.sender, ipfsHash);
    }

    /**
     * @notice Distributor ships product to retailer.
     * @dev Custody is transferred to retailer in the current draft design.
     * @param prodId Unique product ID.
     * @param retailer Address of the retailer receiving the product.
     * @param ipfsHash Updated off-chain metadata pointer.
     */
    function shipToRetailer(
        uint256 prodId,
        address retailer,
        string memory ipfsHash
    ) public onlyRole(Role.Distributor) productExists(prodId) {
        Product storage product = productLedger[prodId];

        require(rolesMapping[retailer] == Role.Retailer, "Destination address is not a retailer");
        require(product.currentOwner == msg.sender, "Only current distributor can ship this product");
        require(product.currentStatus == ProductStatus.InWarehouse, "Product must be in warehouse");

        address previousOwner = product.currentOwner;
        product.currentOwner = retailer;
        product.currentStatus = ProductStatus.ShippedToRetailer;
        product.ipfsHash = ipfsHash;

        emit ProductOwnershipTransferred(prodId, previousOwner, retailer);
        emit ProductStatusChanged(prodId, ProductStatus.ShippedToRetailer, msg.sender, ipfsHash);
    }

    /**
     * @notice Distributor receives a returned product from retailer.
     * @dev This function is included in the draft for reverse logistics handling.
     * @param prodId Unique product ID.
     * @param ipfsHash Updated off-chain metadata pointer.
     */
    function receiveReturnedFromRetailer(
        uint256 prodId,
        string memory ipfsHash
    ) public onlyRole(Role.Distributor) productExists(prodId) {
        Product storage product = productLedger[prodId];

        require(
            product.currentStatus == ProductStatus.RetailerReturnedToWarehouse,
            "Product has not been marked as returned by retailer"
        );

        address previousOwner = product.currentOwner;
        product.currentOwner = msg.sender;
        product.currentStatus = ProductStatus.InWarehouse;
        product.ipfsHash = ipfsHash;

        emit ProductOwnershipTransferred(prodId, previousOwner, msg.sender);
        emit ProductStatusChanged(prodId, ProductStatus.InWarehouse, msg.sender, ipfsHash);
    }

    /************************************
     * Retailer Functions (Draft Only)
     ************************************/

    /**
     * @notice Retailer receives product from distributor.
     * @dev Draft placeholder for later implementation.
     */
    function retailerReceiveProduct(
        uint256 prodId,
        string memory ipfsHash
    ) public onlyRole(Role.Retailer) productExists(prodId) {
        // Intended logic:
        // 1. Verify product was shipped to retailer.
        // 2. Confirm retailer custody.
        // 3. Update retailer-side receiving / QC status.
        // 4. Emit status change event.

        Product storage product = productLedger[prodId];
        product.ipfsHash = ipfsHash;
        prodId; // silence warning in draft version
    }

    /**
     * @notice Retailer marks product as available in store.
     * @dev Draft placeholder for later implementation.
     */
    function placeInStore(
        uint256 prodId,
        string memory ipfsHash
    ) public onlyRole(Role.Retailer) productExists(prodId) {
        // Intended logic:
        // 1. Verify retailer has accepted the product.
        // 2. Mark product as available for sale.
        // 3. Emit status change event.

        Product storage product = productLedger[prodId];
        product.ipfsHash = ipfsHash;
        prodId;
    }

    /**
     * @notice Retailer returns product to warehouse/distributor.
     * @dev Draft placeholder for later implementation.
     */
    function returnToWarehouse(
        uint256 prodId,
        string memory ipfsHash
    ) public onlyRole(Role.Retailer) productExists(prodId) {
        // Intended logic:
        // 1. Verify retailer currently holds the product.
        // 2. Mark product as returned to warehouse.
        // 3. Emit status change event.

        Product storage product = productLedger[prodId];
        product.ipfsHash = ipfsHash;
        prodId;
    }

    /************************************
     * Consumer Functions (Draft Only)
     ************************************/

    /**
     * @notice Consumer verifies product information.
     * @dev Draft placeholder. Final UI may call this through frontend or API.
     */
    function verifyProduct(uint256 prodId)
        public
        view
        productExists(prodId)
        returns (Product memory)
    {
        return productLedger[prodId];
    }

    /**
     * @notice Consumer purchases a product.
     * @dev Draft placeholder for later implementation.
     */
    function purchaseProduct(uint256 prodId)
        public
        onlyRole(Role.Consumer)
        productExists(prodId)
    {
        // Intended logic:
        // 1. Verify product is in store.
        // 2. Mark product as sold.
        // 3. Optionally assign final ownership to consumer.
        // 4. Emit status change event.

        prodId;
    }

    /************************************
     * View Functions
     ************************************/

    /**
     * @notice Returns the on-chain record for one product.
     * @param prodId Unique product ID.
     */
    function getProduct(uint256 prodId)
        public
        view
        productExists(prodId)
        returns (Product memory)
    {
        return productLedger[prodId];
    }
}