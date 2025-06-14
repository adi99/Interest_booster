# APYboost
## Inspiration 
The inspiration for this project comes from low interest platform available on blockchain. I wanted to create a project which will produce larger Interest Rate without having too much risk.

## What it does
APYboost uses Flash loan (due to unavailability of Flash loan with JustLend it uses leverage by borrowing and reinvesting ) to multiply the interest rates up to 2.5 times.

## How we built it
The frontend is built with javascript using Node-js. The backend smart contract is build with solidity language

## Challenges we ran into
When we started the project the plan was to get leverage using Flash loan. After trying for few days for flash loan in different Protocol on Tron Network we thought about changing method to get leverage to boost interest rate.
So we come to a new method of borrowing and reinvesting the borrow, multiple time to boost the APY for sTRX on mainnet and JST on testnet. 

## Accomplishments that we're proud of
We have  tried it different chains from polygon to optimism with Flash loans and we are sucessfully achieved it. On Tron we have tried it using reinvesting but it was very hard to manage both energy and banwidth.

## What we learned
I have learned to think about new way to find the solution of my problem

## What's next for APYboost
Deployment on Mainnet and make it successful


