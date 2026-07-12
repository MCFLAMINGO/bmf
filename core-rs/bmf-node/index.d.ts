/** Rust bmf-core bindings. JSON string in, JSON string out. */
export interface BmfNodeBindings {
  /** Parse URDF XML → `{"robot":..., "capabilities":[...]}` JSON string. */
  parseUrdf(src: string): string;
  /** Parse MJCF XML → `{"robot":..., "capabilities":[...]}` JSON string. */
  parseMjcf(src: string): string;
}

declare const binding: BmfNodeBindings;
export = binding;
