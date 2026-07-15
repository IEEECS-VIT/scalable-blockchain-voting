pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

// Unified V3 statement. A voter proves private membership in an election
// eligibility tree, derives exactly one election nullifier from the credential
// secret, and proves that a four-candidate BabyJubJub EC-ElGamal ballot is a
// valid one-hot encryption. No per-voter on-chain registration is required.
template EligibleBallot(candidateCount, eligibilityTreeDepth) {
    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];
    var SUBGROUP_ORDER =
        2736030358979909402780800718157159386076813972158567259200215660948447373041;
    var SCALAR_BITS = 251;
    var NULLIFIER_DOMAIN = 2026071301;

    signal input electionId;
    signal input candidateListHash;
    signal input eligibilityRoot;
    signal input ballotNullifier;
    signal input packageCommitment;
    signal input electionPublicKey[2];
    signal input c1[candidateCount][2];
    signal input c2[candidateCount][2];

    signal input credentialSecret;
    signal input credentialNonce;
    signal input eligibilityPathElements[eligibilityTreeDepth];
    signal input eligibilityPathIndices[eligibilityTreeDepth];
    signal input selection[candidateCount];
    signal input randomness[candidateCount];

    component credentialSecretNonZero = IsZero();
    credentialSecretNonZero.in <== credentialSecret;
    credentialSecretNonZero.out === 0;

    component credentialLeaf = Poseidon(2);
    credentialLeaf.inputs[0] <== credentialSecret;
    credentialLeaf.inputs[1] <== credentialNonce;

    signal eligibilityNodes[eligibilityTreeDepth + 1];
    signal eligibilityLeft[eligibilityTreeDepth];
    signal eligibilityRight[eligibilityTreeDepth];
    eligibilityNodes[0] <== credentialLeaf.out;
    component eligibilityHasher[eligibilityTreeDepth];
    for (var level = 0; level < eligibilityTreeDepth; level++) {
        eligibilityPathIndices[level] * (eligibilityPathIndices[level] - 1) === 0;
        eligibilityHasher[level] = Poseidon(2);
        eligibilityLeft[level] <== eligibilityNodes[level] +
            eligibilityPathIndices[level] *
            (eligibilityPathElements[level] - eligibilityNodes[level]);
        eligibilityRight[level] <== eligibilityPathElements[level] +
            eligibilityPathIndices[level] *
            (eligibilityNodes[level] - eligibilityPathElements[level]);
        eligibilityHasher[level].inputs[0] <== eligibilityLeft[level];
        eligibilityHasher[level].inputs[1] <== eligibilityRight[level];
        eligibilityNodes[level + 1] <== eligibilityHasher[level].out;
    }
    eligibilityNodes[eligibilityTreeDepth] === eligibilityRoot;

    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== NULLIFIER_DOMAIN;
    nullifierHash.inputs[1] <== electionId;
    nullifierHash.inputs[2] <== credentialSecret;
    nullifierHash.out === ballotNullifier;

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

    // V3 package commitment also binds the eligibility root.
    component commitmentLeaf[4];
    for (var leaf = 0; leaf < 4; leaf++) {
        commitmentLeaf[leaf] = Poseidon(6);
    }
    commitmentLeaf[0].inputs[0] <== electionId;
    commitmentLeaf[0].inputs[1] <== candidateListHash;
    commitmentLeaf[0].inputs[2] <== eligibilityRoot;
    commitmentLeaf[0].inputs[3] <== ballotNullifier;
    commitmentLeaf[0].inputs[4] <== electionPublicKey[0];
    commitmentLeaf[0].inputs[5] <== electionPublicKey[1];

    commitmentLeaf[1].inputs[0] <== c1[0][0];
    commitmentLeaf[1].inputs[1] <== c1[0][1];
    commitmentLeaf[1].inputs[2] <== c1[1][0];
    commitmentLeaf[1].inputs[3] <== c1[1][1];
    commitmentLeaf[1].inputs[4] <== c1[2][0];
    commitmentLeaf[1].inputs[5] <== c1[2][1];

    commitmentLeaf[2].inputs[0] <== c1[3][0];
    commitmentLeaf[2].inputs[1] <== c1[3][1];
    commitmentLeaf[2].inputs[2] <== c2[0][0];
    commitmentLeaf[2].inputs[3] <== c2[0][1];
    commitmentLeaf[2].inputs[4] <== c2[1][0];
    commitmentLeaf[2].inputs[5] <== c2[1][1];

    commitmentLeaf[3].inputs[0] <== c2[2][0];
    commitmentLeaf[3].inputs[1] <== c2[2][1];
    commitmentLeaf[3].inputs[2] <== c2[3][0];
    commitmentLeaf[3].inputs[3] <== c2[3][1];
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
    eligibilityRoot,
    ballotNullifier,
    packageCommitment,
    electionPublicKey,
    c1,
    c2
]} = EligibleBallot(4, 24);
