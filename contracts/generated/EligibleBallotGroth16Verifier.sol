// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract EligibleBallotGroth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 1113064256125227612701111989934518007982279036622435250681811428217492785724;
    uint256 constant alphay  = 21132936025368863788092418826592420435463905937443902583400372166957320380197;
    uint256 constant betax1  = 3760981122831597877738422725001109276726319517698764962822585660934163658873;
    uint256 constant betax2  = 21256679532669416758902286179100020200422667879528003395968027167394416585093;
    uint256 constant betay1  = 3997389962266631431475556547076156709013797005280587104166801031823890512693;
    uint256 constant betay2  = 3883573132905166356413000388603169398195195457230229728697236116489028294618;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 6349848549239207838901200652634240384772548130422661919876263466193505298387;
    uint256 constant deltax2 = 13897068338001754608807355320481538542534357048608809171420746522353908304216;
    uint256 constant deltay1 = 4965302681598246629708351127891743870030590189592139722677427674236247748096;
    uint256 constant deltay2 = 3697326171556081496423199604819168308128068515097603006935021924173154789802;

    
    uint256 constant IC0x = 17118031426306906573106967815915897327913669082588847107961498223576654219230;
    uint256 constant IC0y = 21150773314629449134651566021781471079500365195736501608187020521140765888900;
    
    uint256 constant IC1x = 18757933812242138415484879170382869560733940665065114493314797982014340405972;
    uint256 constant IC1y = 4490808615920073720137184666895969925695943151338313061981000783709154319642;
    
    uint256 constant IC2x = 7665279660759150019447593741007953160083344177507444786007461023315611366793;
    uint256 constant IC2y = 7869494085940812278709256278604850309846287723208686933288160459188542963784;
    
    uint256 constant IC3x = 7357156903882293798490327415772769376967074688350320923106363710444742424388;
    uint256 constant IC3y = 3666585990499031536681253974261892366788506714721167236689075238567682559777;
    
    uint256 constant IC4x = 21790125762966165638887898588569640112848846482275288081721719752369668539432;
    uint256 constant IC4y = 14693099830672516700623702434951198724188757506286202502827338629367320303394;
    
    uint256 constant IC5x = 9781098953583902299738663072971002840987435277352184386038477553687983822347;
    uint256 constant IC5y = 6937214813125498598862158884557591060278032047557148279383345399384379270122;
    
    uint256 constant IC6x = 8856062924156511333615476146829314675321751591001496939308101030645995063574;
    uint256 constant IC6y = 10806211864083035250946078135265612062834551703340753313762874940780532396910;
    
    uint256 constant IC7x = 5458964291666793503854728675233898576558983988315485290923974870273693695675;
    uint256 constant IC7y = 16041428106490987011027229391592931625786735275297692920074256830583286700234;
    
    uint256 constant IC8x = 20660286251828368016962731840459884702053007562832277086038379221076268342806;
    uint256 constant IC8y = 13988733776740363385303969157333617024810927464927070030976075094171859112134;
    
    uint256 constant IC9x = 17138451629212440185904692430311252440009484038891259482364042674619233229705;
    uint256 constant IC9y = 6131085151350635532805099795171157296168142123713694962041565221781963066934;
    
    uint256 constant IC10x = 6443874406458682073576086764579958415646802022161159129744512574989067881888;
    uint256 constant IC10y = 3172319808905650637322277989215459770614748976083341814303337001062033924381;
    
    uint256 constant IC11x = 5442520857041767567113642147174352614466747242484089188631149080970821676153;
    uint256 constant IC11y = 14143139880011090245124492384534402644535186310247595005725898606125695486166;
    
    uint256 constant IC12x = 19300093705388520429383615102969267494132493312172239698822718290696042007506;
    uint256 constant IC12y = 8931796967591434964819091794762723606645528755076475180346894298309174316802;
    
    uint256 constant IC13x = 12287228450408353395020307799053599085485794286254392312793574950633546861304;
    uint256 constant IC13y = 67959759161550494427512125834004954525165739950565844927201878845502082277;
    
    uint256 constant IC14x = 15153420128647268221215036435829275305805619992617317625353942970287042927677;
    uint256 constant IC14y = 13825084972914720949147921147400936928489277776914796428464644760280085078521;
    
    uint256 constant IC15x = 6176755396203000074021320854990171769039240381757532890381650599897382113640;
    uint256 constant IC15y = 8412242613243148608058792168954840696697317631084970084370720851013844909612;
    
    uint256 constant IC16x = 17332970784702295451374517781438225733492012157998528775550528754299589351752;
    uint256 constant IC16y = 2974036464482204354528849349514060921009650486714850375520740449068635324622;
    
    uint256 constant IC17x = 1939243836794438542272281671198594891617685069871567035372276866226097610084;
    uint256 constant IC17y = 9067151236748479652022249018259455015397452686008045129890059531113038221307;
    
    uint256 constant IC18x = 16956898946869588288324998799160455668738363344044199504594199866712424651748;
    uint256 constant IC18y = 6135566304754758736177431577884077021547171123260196033543816051541334941576;
    
    uint256 constant IC19x = 790551165195326407306198893043991078393172236968785182234554534650811775846;
    uint256 constant IC19y = 3568705043464930526891129969830811829951881950641049381979573505007912738346;
    
    uint256 constant IC20x = 3082267688657460638140427806974039882774331973561486035008934466843665949663;
    uint256 constant IC20y = 18807463289574004201745190123909441917765231662626733367088244136634382009846;
    
    uint256 constant IC21x = 14916220369158865698049550098749493959376541890324873875302463159202237108102;
    uint256 constant IC21y = 7272644841317904387666836043377283855845480261244130587523891684443624585454;
    
    uint256 constant IC22x = 4580714422781787402498616767299217183843189587913583688050536942171632909731;
    uint256 constant IC22y = 18204536456115359095896129942641837097116487913851075460199380582284739251662;
    
    uint256 constant IC23x = 7974974847807596943887554991061263567797735890842457502054464576530835465163;
    uint256 constant IC23y = 15315898974770416988672965187641712377338597905906454218990924764059164542524;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[23] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                
                g1_mulAccC(_pVk, IC22x, IC22y, calldataload(add(pubSignals, 672)))
                
                g1_mulAccC(_pVk, IC23x, IC23y, calldataload(add(pubSignals, 704)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            
            checkField(calldataload(add(_pubSignals, 672)))
            
            checkField(calldataload(add(_pubSignals, 704)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
