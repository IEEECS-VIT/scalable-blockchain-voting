pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

// Proves that a four-candidate BabyJubJub EC-ElGamal ballot encrypts a
// one-hot vector. The selected candidate and encryption randomness stay
// private. Election/candidate/nullifier values are public domain bindings.
template BallotValidity(candidateCount) {
    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];
    var SUBGROUP_ORDER =
        2736030358979909402780800718157159386076813972158567259207130577147503137;
    var SCALAR_BITS = 241;

    signal input electionId;
    signal input candidateListHash;
    signal input ballotNullifier;
    signal input packageCommitment;
    signal input electionPublicKey[2];
    signal input c1[candidateCount][2];
    signal input c2[candidateCount][2];

    signal input selection[candidateCount];
    signal input randomness[candidateCount];

    component publicKeyCheck = BabyCheck();
    publicKeyCheck.x <== electionPublicKey[0];
    publicKeyCheck.y <== electionPublicKey[1];

    signal selectionSum[candidateCount + 1];
    selectionSum[0] <== 0;

    component randomnessBits[candidateCount];
    component randomnessInRange[candidateCount];
    component randomnessNonZero[candidateCount];
    component c1Mul[candidateCount];
    component sharedSecretMul[candidateCount];
    component c2Add[candidateCount];

    for (var i = 0; i < candidateCount; i++) {
        selection[i] * (selection[i] - 1) === 0;
        selectionSum[i + 1] <== selectionSum[i] + selection[i];

        randomnessBits[i] = Num2Bits(SCALAR_BITS);
        randomnessBits[i].in <== randomness[i];

        randomnessInRange[i] = LessThan(SCALAR_BITS);
        randomnessInRange[i].in[0] <== randomness[i];
        randomnessInRange[i].in[1] <== SUBGROUP_ORDER;
        randomnessInRange[i].out === 1;

        randomnessNonZero[i] = IsZero();
        randomnessNonZero[i].in <== randomness[i];
        randomnessNonZero[i].out === 0;

        c1Mul[i] = EscalarMulFix(SCALAR_BITS, BASE8);
        sharedSecretMul[i] = EscalarMulAny(SCALAR_BITS);
        for (var bit = 0; bit < SCALAR_BITS; bit++) {
            c1Mul[i].e[bit] <== randomnessBits[i].out[bit];
            sharedSecretMul[i].e[bit] <== randomnessBits[i].out[bit];
        }
        sharedSecretMul[i].p[0] <== electionPublicKey[0];
        sharedSecretMul[i].p[1] <== electionPublicKey[1];

        c1Mul[i].out[0] === c1[i][0];
        c1Mul[i].out[1] === c1[i][1];

        c2Add[i] = BabyAdd();
        c2Add[i].x1 <== sharedSecretMul[i].out[0];
        c2Add[i].y1 <== sharedSecretMul[i].out[1];
        c2Add[i].x2 <== selection[i] * BASE8[0];
        c2Add[i].y2 <== 1 + selection[i] * (BASE8[1] - 1);
        c2Add[i].xout === c2[i][0];
        c2Add[i].yout === c2[i][1];
    }

    selectionSum[candidateCount] === 1;

    // Commit the exact public ballot statement in small Poseidon chunks. The
    // resulting field element is stored as VotingContract.votePackageDigest.
    component commitmentLeaf[4];
    for (var leaf = 0; leaf < 4; leaf++) {
        commitmentLeaf[leaf] = Poseidon(6);
    }
    commitmentLeaf[0].inputs[0] <== electionId;
    commitmentLeaf[0].inputs[1] <== candidateListHash;
    commitmentLeaf[0].inputs[2] <== ballotNullifier;
    commitmentLeaf[0].inputs[3] <== electionPublicKey[0];
    commitmentLeaf[0].inputs[4] <== electionPublicKey[1];
    commitmentLeaf[0].inputs[5] <== c1[0][0];

    commitmentLeaf[1].inputs[0] <== c1[0][1];
    commitmentLeaf[1].inputs[1] <== c1[1][0];
    commitmentLeaf[1].inputs[2] <== c1[1][1];
    commitmentLeaf[1].inputs[3] <== c1[2][0];
    commitmentLeaf[1].inputs[4] <== c1[2][1];
    commitmentLeaf[1].inputs[5] <== c1[3][0];

    commitmentLeaf[2].inputs[0] <== c1[3][1];
    commitmentLeaf[2].inputs[1] <== c2[0][0];
    commitmentLeaf[2].inputs[2] <== c2[0][1];
    commitmentLeaf[2].inputs[3] <== c2[1][0];
    commitmentLeaf[2].inputs[4] <== c2[1][1];
    commitmentLeaf[2].inputs[5] <== c2[2][0];

    commitmentLeaf[3].inputs[0] <== c2[2][1];
    commitmentLeaf[3].inputs[1] <== c2[3][0];
    commitmentLeaf[3].inputs[2] <== c2[3][1];
    commitmentLeaf[3].inputs[3] <== 0;
    commitmentLeaf[3].inputs[4] <== 0;
    commitmentLeaf[3].inputs[5] <== 0;

    component commitmentRoot = Poseidon(4);
    for (var rootIndex = 0; rootIndex < 4; rootIndex++) {
        commitmentRoot.inputs[rootIndex] <== commitmentLeaf[rootIndex].out;
    }
    commitmentRoot.out === packageCommitment;
}

component main {public [
    electionId,
    candidateListHash,
    ballotNullifier,
    packageCommitment,
    electionPublicKey,
    c1,
    c2
]} = BallotValidity(4);
