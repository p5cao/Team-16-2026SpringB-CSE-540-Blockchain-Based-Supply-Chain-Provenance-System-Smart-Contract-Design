// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;


contract Lottery {
  address public admin;


  event Withdrawal(uint amount, uint when);

  constructor() payable {
    admin = msg.sender;

   
  }
}
