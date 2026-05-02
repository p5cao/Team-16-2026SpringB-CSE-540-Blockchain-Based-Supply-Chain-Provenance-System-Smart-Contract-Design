
export const CONTRACT_ABI = [
  // Emitted by assignRole()
  'event RoleAssigned(address indexed user, uint8 role)',

  // Emitted by createProduct()
  'event ProductCreated(uint256 indexed prodId, address indexed producer, string ipfsHash)',

  // Emitted by every status-changing function
  'event ProductStatusChanged(uint256 indexed prodId, uint8 newStatus, address indexed updatedBy, string ipfsHash)',

  // Emitted on every custody transfer
  'event ProductOwnershipTransferred(uint256 indexed prodId, address indexed previousOwner, address indexed newOwner)',
];
