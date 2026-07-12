declare module "circomlibjs" {
  type Field = {
    e(value: unknown): unknown;
    toObject(value: unknown): { toString(): string };
  };

  type BabyJub = {
    F: Field;
    Base8: readonly unknown[];
    addPoint(left: readonly unknown[], right: readonly unknown[]): readonly unknown[];
    inSubgroup(point: readonly unknown[]): boolean;
    mulPointEscalar(point: readonly unknown[], scalar: bigint): readonly unknown[];
  };

  export function buildBabyjub(): Promise<BabyJub>;
  export function buildPoseidon(): Promise<{
    (inputs: readonly bigint[]): unknown;
    F: Field;
  }>;
}
