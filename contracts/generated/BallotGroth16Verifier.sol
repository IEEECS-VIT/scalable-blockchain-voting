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

contract BallotGroth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 15068879967504378685663909850266273316798727026258639801465826144852846700942;
    uint256 constant alphay  = 657427980570003836791055004205761023726513295480974920993816276186567549647;
    uint256 constant betax1  = 18239610127436019217054294006871457892851429794189894953720499262927471243313;
    uint256 constant betax2  = 16466463447869998713335806930819366316704147103439555237954275354107609260933;
    uint256 constant betay1  = 12790095691554924981392981232256861372085651790862474867629445343316112276959;
    uint256 constant betay2  = 16380784581710215988832331769682299979926915868965188343393611129581160978851;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 2774488654520851188824292541580545301587566377913036066312845478087336818880;
    uint256 constant deltax2 = 2576671100988479444749425616700637326747888966536534064951202341637084633348;
    uint256 constant deltay1 = 21499838620830748833507374018020544861755295203146674388962109325814847872002;
    uint256 constant deltay2 = 4925211293080368303258944161312356887034586892436798116094236808501998351308;

    
    uint256 constant IC0x = 7599156436350846906310461090139422669973620956574032733957854198726337936953;
    uint256 constant IC0y = 20184786993791230259988205975012549908041269378324636555926803197751953974370;
    
    uint256 constant IC1x = 15006529105100608374176579767407877715946380651294872684230890216930996242830;
    uint256 constant IC1y = 19984685453439700167126097251487215064697938641436851263814314747991139153338;
    
    uint256 constant IC2x = 1718314176499174452004224759893947977654102741666645830815885983920445350637;
    uint256 constant IC2y = 19500217714359344009327058120730339556291651118272979792076940826271945555996;
    
    uint256 constant IC3x = 2531106768406185528665274671632810901356948654592990662833349087834047222831;
    uint256 constant IC3y = 2301602721450421354175492341000663288051022226413101012542852578252987238447;
    
    uint256 constant IC4x = 19517217198697596785731511192357787689013485537794427593448740876119533554392;
    uint256 constant IC4y = 349099326078923882486755185436214630650943515916938293425210958832174748915;
    
    uint256 constant IC5x = 8044446056593934278196705491267709738115263968508987727174829655538944621881;
    uint256 constant IC5y = 10789793320311307634054472516521076816861120263557083541532574019364904023969;
    
    uint256 constant IC6x = 17791669499577950517259769238343920817250985031484309871476162672356517903724;
    uint256 constant IC6y = 20456310428957721618542465641659230767279184756859410496113425892368184579425;
    
    uint256 constant IC7x = 1101268287785026884174356132080323017769009615089839616708002819382003679858;
    uint256 constant IC7y = 10704269664718159128979840381975230537434441043240722584951831473955230319405;
    
    uint256 constant IC8x = 6363065667768203976717113848448310770999650733244591123864230746465661249064;
    uint256 constant IC8y = 16436696307831968783617064696736640920118508680709286117594798700857671953671;
    
    uint256 constant IC9x = 11204806681362182259685724526925538598114246412113253983702848097598570251328;
    uint256 constant IC9y = 13099010740495195398682578958794525640043548536088217561417413327153589039426;
    
    uint256 constant IC10x = 8592663297949463741246243434779583389192164039757059526710414360826432879478;
    uint256 constant IC10y = 5929144347598123178198038122088186273760510904971078836683598539391525478289;
    
    uint256 constant IC11x = 19546222466883597075523609142922664280225949763005188845189691096998024725953;
    uint256 constant IC11y = 648513911067580444148024631617688571148646830345081846479814196165266714024;
    
    uint256 constant IC12x = 3914698778369840719423048746853222907973138983307341276410271005873518851230;
    uint256 constant IC12y = 4379264368236206544865191638811755379240933783248077752456678636449102774541;
    
    uint256 constant IC13x = 561162274039146180692618965738532238942864823488623697115605231404821847501;
    uint256 constant IC13y = 14349663581353431033585991022492537892648473175028936033434147738881538496924;
    
    uint256 constant IC14x = 19605248931495288834674620156870703014113539560637641170318144010139304519881;
    uint256 constant IC14y = 7412813831278388418585438885672542806492753283569106585653548068420134061316;
    
    uint256 constant IC15x = 1879406183447555381404983826947823257706465711203692343228015452279798160981;
    uint256 constant IC15y = 2065916906432303175521977223822617065808451834879612578254859496205822114032;
    
    uint256 constant IC16x = 3784252821507511205841308846261326858062501684239239662132883443864067040803;
    uint256 constant IC16y = 777047603110998810769021912187644614901861584674628235082592149215071306484;
    
    uint256 constant IC17x = 9229129866536852017354912002255942582923298124761360377652672134148320276808;
    uint256 constant IC17y = 11098244258218642603479069579486013096721864906796200855931335906040497513312;
    
    uint256 constant IC18x = 14163082508315860126007837052644592791285381729610866358939046977267118718488;
    uint256 constant IC18y = 4723299587295011216018595121801051167907724151178723011045185966621134720470;
    
    uint256 constant IC19x = 14906332075964115375949506064538834619727646439486860072727548923016071654414;
    uint256 constant IC19y = 6476109682099856422209738558323338450281511224322108002267105341355729717951;
    
    uint256 constant IC20x = 11485099227041967569130538151481094157764765126205155713361595638849043068609;
    uint256 constant IC20y = 11506012667567045048835602402210471542721108633696384496190161635081179391172;
    
    uint256 constant IC21x = 6983131337549471343755221257907815043059736523909588586845458620490636240753;
    uint256 constant IC21y = 396109775286546110209539891739111566006966236681453499359840107483499020868;
    
    uint256 constant IC22x = 4909364160075478586042586292923539565643878768010560755196170203994910192718;
    uint256 constant IC22y = 16959813081760477596933968866111165423855479956790335433162741343370654254019;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[22] calldata _pubSignals) public view returns (bool) {
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
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
