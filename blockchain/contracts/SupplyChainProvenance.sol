
    

pragma solidity ^0.8.28;

// import "hardhat/console.sol";

contract SupplyChainProvenance {

    // Developer is considerd as the admin,
    // when the contract is deployed, the deployer address will be assigned with the admin role.
    // The admin has the authority to assign roles to other users (e.g., producer, distributor, retailer, consumer) 
    address public admin;

    // New Status of the user before registration, 
    enum Role { UnRegistered, Producer, Consumer, Distributor, Retailer, Admin, Auditor }
    
    // userRoleMapping for authorization and access control 
    mapping(address => Role) public rolesMapping;

    enum ProductStatus {
        InProduction, // Product is being manufactured by the producer.
        ReadyToShip, // Product is ready to be shipped to the warehouse.
        InTransitToWarehouse, 
        ShippedToWarehouse,
        WHQualityCheckPassed, // Product has passed quality check at the warehouse putaway to inventory.
        ReturnedToProducer, // Product is returned to the producer due to quality check failure at the warehouse.
        InWarehouse, // Product is stored in the warehouse.
        InTransitToRetailer,
        ShippedToRetailer,
        RetailerQualityCheckPassed,
        RetailerReturnedToWarehouse,
        InStore, // Product is on the shelf at the retailer's store.
        Sold    // product is sold to the end consumer.
    }

    struct Product {
        // Unique identifier for the product batch
        uint256 prodId; 
        // Address of the producer Static value assigned at creation
        address producer; 
        // Address of the producer Static value assigned at creation
        uint256 producerBatchId;
        // off-chain data pointer for other information about the product (e.g., manufacturing details, images )
        string ipfsHash; 
        uint256 expirationDate;

        // following fields are for tracking the product lifecycle and ownership
        uint256 currentBatchId; 
        ProductStatus currentStatus;
        // Identifier for the current owner (could be producer, distributor, retailer, or consumer)
        address currentOwner;
        // Identifier for the parent batch, if batch get splitted into smaller batches at the warehouses  
        uint256 parentBatchId; 
    }


    // master ledger to store all products 
    mapping(uint256 => Product) public productLedger;

    event ProductStatusUpdated(
        uint256 indexed prodId, 
        ProductStatus previousStatus, 
        ProductStatus newStatus, 
        address indexed actor,
        address indexed newOwner,
        string ipfsHash);


    event RoleAssigned(
        address indexed admin,
        address indexed user, 
        Role role
    );

    constructor() {
        admin = msg.sender;
        rolesMapping[admin] = Role.Admin;
    }
    
    /************************************************
    * User Management and Role-Based Access Control
    *************************************************/
    
    /**
     * @notice Assigns a role to a user address.
     * @dev Only callable by an account with the Admin role.
     * @param user The address of the user to assign a role to.
     * @param role The role to assign to the user.
     */
    function assignRole(address user, Role role) public adminOnly {
        rolesMapping[user] = role;
        emit RoleAssigned(admin, user, role);
    }


    /**
     * @notice Restricts function access to only Admin role.
     * @dev Reverts if the caller is not an Admin.
     */
    modifier adminOnly() {
        require(rolesMapping[msg.sender] == Role.Admin, "Unauthorized: Only Admin can assign roles");
        _;
    }

    /**
     * @notice Restricts function access to a specific role.
     * @dev Reverts if the caller does not have the required role.
     * @param _role The required role for access.
     */
    modifier roleCheker(Role _role) {
        require(rolesMapping[msg.sender] != Role.UnRegistered, "User does not exist.");
        require(rolesMapping[msg.sender] == _role, "Unauthorized: You do not have the required role. Contact Admin for access.");
        _;
    }


    /**
     * @notice Registers the sender as a new user with the default role (UnRegistered).
     * @dev Reverts if the user is already registered (role is not UnRegistered).
     */
    function registerMe() public {
        require(rolesMapping[msg.sender] == Role.UnRegistered, "You are already registered");
        rolesMapping[msg.sender] = Role.UnRegistered;
    }
    

    /************************************************
    * Producer Capabilities
    * (creating product batch, making the product ready for shipping to the warehouse)
    *************************************************/
    
    /**
     * @notice Registers a new product blockchain.
     * @dev Creates a new Product struct and assigns the initial ownership to the msg.sender (Manufacturer).
     * @param prodId Unique identifier for the product batch.
     * @param ipfsHash hash of off-chain data pointing to the product's detailed information.
     */
    function createProduct(uint256 prodId, string memory ipfsHash) public roleCheker(Role.Producer){
        // Intended Logic:
        // 1. Verify the prodId does not already exist.
        // 2. Create a new Product in the InProduction Status.
        // 3. Emit the ProductRegistered event.
    }


    /**
     * @notice Producer Make the produt ready for shipping to the warehouse.
     * @param prodId Unique identifier for the product batch.
     * @param ipfsHash hash of off-chain data pointing to the product's detailed information.
     */
    
    function produce(uint256 prodId, string memory ipfsHash) public roleCheker(Role.Producer){
        // Intended Logic:
        // 1. Verify the prodId is in In_production Status.
        // 2. Update the product status to ReadyToShip.
        // 3. Emit the ProductReadyToShip event.
    }
    

    /************************************************
    * Distributor's Capabilities 
    * (receiving from producer, quality check at warehouse, shipping, receiving the returned product from retailer)
    *************************************************/


    /************************************************
    * Retailer's Capabilities 
    * (receiving, quality check, returning to warehouse, putting on shelf, selling to consumer)
    *************************************************/

    // retailer receive the product 
    function receiveAtRetailer(uint256 prodId, string memory ipfsHash) public roleCheker(Role.Retailer){
        Product storage product = productLedger[prodId];
        require(product.producer != address(0), "Product does not exist.");
        require(product.currentStatus == ProductStatus.InTransitToRetailer, "Invalid status transition");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");

        ProductStatus previousStatus = product.currentStatus;
        product.currentStatus = ProductStatus.ShippedToRetailer;
        product.currentOwner = msg.sender;
        product.ipfsHash = ipfsHash;

        emit ProductStatusUpdated(prodId, previousStatus, product.currentStatus, msg.sender, product.currentOwner, ipfsHash);
    }

    // retailer pass quality check of the product 
    function retailerQualityCheckPassed(uint256 prodId, string memory ipfsHash) public roleCheker(Role.Retailer){
        Product storage product = productLedger[prodId];
        require(product.producer != address(0), "Product does not exist.");
        require(product.currentOwner == msg.sender, "Only the current owner can perform quality check");
        require(product.currentStatus == ProductStatus.ShippedToRetailer, "Invalid status transition");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");

        ProductStatus previousStatus = product.currentStatus;
        product.currentStatus = ProductStatus.RetailerQualityCheckPassed;
        product.ipfsHash = ipfsHash;

        emit ProductStatusUpdated(prodId, previousStatus, product.currentStatus, msg.sender, product.currentOwner, ipfsHash);
    }

    // retailer return the product to warehouse 
    function retailerReturnToWarehouse(uint256 prodId, address distributor, string memory ipfsHash) public roleCheker(Role.Retailer){
        Product storage product = productLedger[prodId];
        require(product.producer != address(0), "Product does not exist.");
        require(product.currentOwner == msg.sender, "Only the current owner can perform return");
        require(product.currentStatus == ProductStatus.ShippedToRetailer, "Invalid status transition");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");

        ProductStatus previousStatus = product.currentStatus;
        product.currentStatus = ProductStatus.RetailerReturnedToWarehouse;
        product.currentOwner = distributor; 
        product.ipfsHash = ipfsHash;

        emit ProductStatusUpdated(prodId, previousStatus, product.currentStatus, msg.sender, product.currentOwner, ipfsHash);
    }

    // retailer list the product on shelf
    function putOnShelf(uint256 prodId, string memory ipfsHash) public roleCheker(Role.Retailer){
        Product storage product = productLedger[prodId];
        require(product.producer != address(0), "Product does not exist.");
        require(product.currentOwner == msg.sender, "Only the current owner can put the product on shelf");
        require(product.currentStatus == ProductStatus.RetailerQualityCheckPassed, "Invalid status transition");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");

        ProductStatus previousStatus = product.currentStatus;
        product.currentStatus = ProductStatus.InStore;
        product.ipfsHash = ipfsHash;

        emit ProductStatusUpdated(prodId, previousStatus, product.currentStatus, msg.sender, product.currentOwner, ipfsHash);
    }

    function sellToConsumer(uint256 prodId, address consumer, string memory ipfsHash) public roleCheker(Role.Retailer){
        Product storage product = productLedger[prodId];
        require(product.producer != address(0), "Product does not exist.");
        require(product.currentOwner == msg.sender, "Only the current owner can sell the product");
        require(product.currentStatus == ProductStatus.InStore, "Invalid status transition");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");

        ProductStatus previousStatus = product.currentStatus;
        product.currentStatus = ProductStatus.Sold;
        product.currentOwner = consumer; 
        product.ipfsHash = ipfsHash;

        emit ProductStatusUpdated(prodId, previousStatus, product.currentStatus, msg.sender, product.currentOwner, ipfsHash);
    }

    /************************************************
    * Consumer's Capabilities 
    * (verifying product details, purchasing product)
    *************************************************/


}
