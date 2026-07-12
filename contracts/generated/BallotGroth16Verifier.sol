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
    uint256 constant alphax  = 2698986139387196700050509827295502258898618089977315178110416202432930801690;
    uint256 constant alphay  = 14550346977706300165959685110676548264679576046226310630769040073166018200102;
    uint256 constant betax1  = 18991472375244033777020747984917123073622447052935817825052921369743106640004;
    uint256 constant betax2  = 3797728503483654521555046896930433522945085754869572552571373008705270564997;
    uint256 constant betay1  = 6164570652992893934532355249204500707912515106433364535070972334138875576868;
    uint256 constant betay2  = 2960558080744848218355060200328682698682713430036727041179803022599091565445;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 269284440653186419625150543702775417724260831612508011797681595134621470154;
    uint256 constant deltax2 = 8406557246101460323998951917803401796269814107393028889728602859452744444815;
    uint256 constant deltay1 = 14955066008402339193657293853555218507639424900651894916209862503238257149175;
    uint256 constant deltay2 = 8678645371004646550321988071342307679285047370604591197287015569374304059586;

    
    uint256 constant IC0x = 3380167008362025578566835846828460714535462822440848361145487774790213366063;
    uint256 constant IC0y = 1446599966395771688179859037366040487721240306169271804291773569801401048822;
    
    uint256 constant IC1x = 16045584286139400739530939984374857770697633119231570698661617630292933322669;
    uint256 constant IC1y = 4535474689446440944181748015482979300113947458743967050678981189337247994618;
    
    uint256 constant IC2x = 2351543762862890472361411124765301892860909149683080383386247538609804263281;
    uint256 constant IC2y = 14186091665963366295494379708070335962515316503496078292584690180115564252036;
    
    uint256 constant IC3x = 15850002372371347785444585684859626872698530614247875210836890683442676999111;
    uint256 constant IC3y = 11931277168557088571669306183802180819263853900301370512120543727939754260784;
    
    uint256 constant IC4x = 8796706374576610870047798003490890667944462958709136959905787887269624259428;
    uint256 constant IC4y = 6965236247905814600365339596521822973652257106894739520214880250092730020613;
    
    uint256 constant IC5x = 21354922011377719724705331967376049062691984676891641580047397109224414079165;
    uint256 constant IC5y = 7280833301632893567299822157911449220901608414417527166456958045158328703878;
    
    uint256 constant IC6x = 6901609573100960877777272103931342010794202619874349034515521333102236408127;
    uint256 constant IC6y = 9818039966859955030143389638659659650172103582160918295952235615334151188960;
    
    uint256 constant IC7x = 10324792996422998911776233203826679004065932999102663001530742942366983314212;
    uint256 constant IC7y = 5153530862667024769161482997383743723936295629499413540903199912169254821648;
    
    uint256 constant IC8x = 18387086813319091381616198154971637071691402860347454840338716510236709440477;
    uint256 constant IC8y = 3576865262730531957778931499750989609615745592745691431903037883187210392057;
    
    uint256 constant IC9x = 237822171126006389435454875859658986191174133854916260843345995152615833241;
    uint256 constant IC9y = 19068549022868870242537766697943407796404998383203757988419750247190379765750;
    
    uint256 constant IC10x = 17560508464896285681089653059689321381021135607270070491587258615801941734302;
    uint256 constant IC10y = 2021916619189060523072457852554622071386075992864544570484535729106222146571;
    
    uint256 constant IC11x = 3603819473416130945409935419100780670719906960516144750732758007104275734803;
    uint256 constant IC11y = 15546784393049686149027168675350483923109990406628537199240876757137484432346;
    
    uint256 constant IC12x = 17883249573820271380535995690183986878715357534772726503422733349399686710109;
    uint256 constant IC12y = 72153016704360099197600082370873791487200588094362956256216156535362137987;
    
    uint256 constant IC13x = 2014997729328785564750255506949346504359619618137133480002259300520863295670;
    uint256 constant IC13y = 1749032980052724052640179333468803249707346171091192286993118540097298198657;
    
    uint256 constant IC14x = 16673501971998175281305078075907974139826694967715305629185977029943983879354;
    uint256 constant IC14y = 4640692018716515749501344404883286531732798276348285251645564392168961676357;
    
    uint256 constant IC15x = 12356091574604010281328500365151937691946324644141216562472682013637587623270;
    uint256 constant IC15y = 8220188989040529228047772379575169841816698644351834475278529326377278984145;
    
    uint256 constant IC16x = 20974466383507152909751456606663521365908179718783766795786524668023829017166;
    uint256 constant IC16y = 1640810942664760945617048408321144134958551615046856982490552806470752098011;
    
    uint256 constant IC17x = 21529362913565177902437741253927099588185436199272423337619369256574302483883;
    uint256 constant IC17y = 5857511521927579021078024582630398081725815606339866070382808461986976264608;
    
    uint256 constant IC18x = 21021279230794112937932835220532621413618485110283034399203709101091689341738;
    uint256 constant IC18y = 17374651053713362399214129380433839748882649003318741444207398308189182173046;
    
    uint256 constant IC19x = 11708959610057012034834482334079849635819306400592870405654631962948182637399;
    uint256 constant IC19y = 15636053419180285865674221441060359846126528354999490937173435318740658588532;
    
    uint256 constant IC20x = 16263308619157656224546569700203975060744022423736909405712944006398559850854;
    uint256 constant IC20y = 3237091835853981144973502141086169500786556322787433231209946928215681525871;
    
    uint256 constant IC21x = 7645347407195311276960223114125630061803448485875291480474124508572896266824;
    uint256 constant IC21y = 20110334463789671640436649095624803351437258525849848520895735814241296832145;
    
    uint256 constant IC22x = 7065533731888807046312563278446873611529765527675687943488187027801565938060;
    uint256 constant IC22y = 7722604495940209409770381742449519618132738020382167578472984982645549887192;
    
 
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
