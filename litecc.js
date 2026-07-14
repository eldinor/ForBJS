import { createPhysicsShape as L, PhysicsShapeType as E, setPhysicsBodyShape as Y, releasePhysicsShape as b, createPhysicsCharacterController as _, CharacterSupportedState as B, physicsRaycast as S } from "@babylonjs/lite";
const F = Object.freeze({
  standingHeight: 1.8,
  crouchingHeight: 1.15,
  radius: 0.35,
  gravity: 22,
  jumpSpeed: 9.5,
  groundAcceleration: 45,
  groundBraking: 60,
  airAcceleration: 12,
  walkSpeed: 2.5,
  sprintSpeed: 5,
  crouchSpeed: 1.8,
  crouchSprintSpeed: 3,
  turnSpeed: 12,
  maxSlopeDegrees: 50,
  coyoteTime: 0.12,
  jumpBufferTime: 0.12,
  terminalVelocity: 25,
  characterStrength: 20,
  characterMass: 1,
  maxStepHeight: 0.42,
  stepProbeDistance: 0.45,
  stepSkin: 0.025,
  clearanceSkin: 0.04,
  groundSnapDistance: 0.3,
  ledgeProbeDistance: 0.2,
  ledgeProbeDepth: 3,
  ledgeMinDrop: 0.5,
  fallingAirControlMultiplier: 0.55
});
function N(i = {}) {
  const t = { ...F, ...i };
  if (t.radius <= 0) throw new RangeError("radius must be greater than zero");
  if (t.crouchingHeight < t.radius * 2)
    throw new RangeError("crouchingHeight must be at least twice the capsule radius");
  if (t.standingHeight < t.crouchingHeight)
    throw new RangeError("standingHeight must be greater than or equal to crouchingHeight");
  if (t.maxSlopeDegrees <= 0 || t.maxSlopeDegrees >= 90)
    throw new RangeError("maxSlopeDegrees must be between 0 and 90");
  if (t.walkSpeed < 0 || t.sprintSpeed < 0 || t.crouchSpeed < 0 || t.crouchSprintSpeed < 0 || t.groundAcceleration <= 0 || t.groundBraking <= 0 || t.airAcceleration < 0 || t.turnSpeed < 0 || t.characterStrength < 0 || t.characterMass < 0)
    throw new RangeError("Movement speeds and acceleration values are invalid");
  if (t.maxStepHeight < 0 || t.stepProbeDistance < 0 || t.stepSkin < 0 || t.clearanceSkin < 0 || t.groundSnapDistance < 0 || t.ledgeProbeDistance < 0 || t.ledgeProbeDepth <= 0 || t.ledgeMinDrop < 0 || t.fallingAirControlMultiplier < 0 || t.fallingAirControlMultiplier > 1)
    throw new RangeError("Probe and step configuration values cannot be negative");
  return t;
}
class j {
  listeners = /* @__PURE__ */ new Map();
  on(t, e) {
    let s = this.listeners.get(t);
    return s || (s = /* @__PURE__ */ new Set(), this.listeners.set(t, s)), s.add(e), () => s?.delete(e);
  }
  emit(t, e) {
    for (const s of this.listeners.get(t) ?? []) s(e);
  }
  clear() {
    this.listeners.clear();
  }
}
function D(i) {
  return Math.hypot(i.x, i.z);
}
function k(i) {
  const t = D(i);
  return t > 1e-6 ? { x: i.x / t, y: 0, z: i.z / t } : { x: 0, y: 0, z: 0 };
}
function T(i, t, e) {
  return Math.abs(t - i) <= e ? t : i + Math.sign(t - i) * e;
}
function C(i) {
  return { x: i.x, y: i.y, z: i.z };
}
function I(i, t, e) {
  let s = t - i;
  for (; s > Math.PI; ) s -= Math.PI * 2;
  for (; s < -Math.PI; ) s += Math.PI * 2;
  return i + Math.max(-e, Math.min(e, s));
}
function M(i) {
  const t = i;
  for (const e of ["_world", "_body", "_shape", "_manifold"])
    if (!(e in t))
      throw new Error(
        `LiteCC requires @babylonjs/lite 1.8.0 internals; missing ${e}. Update the LiteCC adapter before changing Babylon Lite versions.`
      );
  return t;
}
function O(i, t, e, s) {
  if (e < s * 2) throw new RangeError("Capsule height cannot be smaller than its diameter");
  const n = M(i), a = n._shape, o = e * 0.5 - s, r = L(n._world, {
    type: E.CAPSULE,
    parameters: {
      pointA: { x: 0, y: o, z: 0 },
      pointB: { x: 0, y: -o, z: 0 },
      radius: s
    }
  });
  try {
    Y(n._world, n._body, r), n._shape = r;
    const h = i.getPosition();
    i.setPosition({
      x: h.x,
      y: h.y + (e - t) * 0.5,
      z: h.z
    }), n._manifold.length = 0, n._bodyTracking?.clear();
  } catch (h) {
    throw b(n._world, r), h;
  }
  b(n._world, a);
}
function U(i) {
  M(i);
}
function A(i) {
  const t = M(i);
  t._manifold.length = 0, t._bodyTracking?.clear();
}
function q(i) {
  const t = M(i);
  for (const e of t._manifold) {
    const s = e;
    if (s.normal && s.normal.y > 0.08 && s.body?.motionType === 1)
      return s.body;
  }
}
const X = { x: 0, y: -1, z: 0 }, Z = { x: 0, y: 1, z: 0 };
class it {
  config;
  physics;
  events = new j();
  stanceValue = "standing";
  groundedValue = !1;
  slidingValue = !1;
  coyoteRemaining = 0;
  jumpBufferRemaining = 0;
  disposed = !1;
  clearanceTest;
  world;
  facingYawValue = 0;
  animatedSupportBody;
  animatedSupportPosition;
  animatedSupportRotation;
  nearLedgeValue = !1;
  ledgeDropValue = null;
  fallingValue = !1;
  fallTimeValue = 0;
  stepMovementDebt = 0;
  supportYawDeltaValue = 0;
  constructor(t, e, s = {}) {
    this.world = t, this.config = N(s), this.physics = _(t, e, {
      capsuleHeight: this.config.standingHeight,
      capsuleRadius: this.config.radius
    }), U(this.physics), this.applyPhysicsConfig();
  }
  get stance() {
    return this.stanceValue;
  }
  get grounded() {
    return this.groundedValue;
  }
  get sliding() {
    return this.slidingValue;
  }
  get facingYaw() {
    return this.facingYawValue;
  }
  setClearanceTest(t) {
    this.clearanceTest = t;
  }
  /** Call exactly once per Havok step, normally from Lite's onPhysicsAfterStep callback. */
  step(t, e) {
    if (this.assertActive(), !Number.isFinite(t) || t <= 0) return this.snapshot();
    const s = Math.min(t, 0.1);
    this.supportYawDeltaValue = 0;
    const n = k(e.move);
    this.updateStance(e.crouch === !0), e.jumpPressed ? this.jumpBufferRemaining = this.config.jumpBufferTime : this.jumpBufferRemaining = Math.max(0, this.jumpBufferRemaining - s);
    const a = this.groundedValue;
    let o = this.physics.checkSupport(s, X);
    if (this.groundedValue = o.supportedState === B.SUPPORTED, this.slidingValue = o.supportedState === B.SLIDING, this.updateLedge(this.groundedValue || a ? n : void 0), !this.groundedValue && a && !this.nearLedgeValue && this.jumpBufferRemaining <= 0 && this.physics.getVelocity().y <= 0) {
      const m = this.trySnapDown();
      m && (o = m, this.groundedValue = !0, this.slidingValue = !1);
    }
    this.followAnimatedSupport(), this.groundedValue ? this.coyoteRemaining = this.config.coyoteTime : this.coyoteRemaining = Math.max(0, this.coyoteRemaining - s);
    const r = this.physics.getVelocity(), h = Math.max(0, e.speed ?? this.modeSpeed(e.sprint === !0)), l = h * s, d = l * 0.65, u = Math.min(this.stepMovementDebt, d);
    this.stepMovementDebt -= u;
    const g = l > 1e-8 ? h * (1 - u / l) : h;
    if (Math.abs(n.x) + Math.abs(n.z) > 1e-6) {
      const m = Math.atan2(n.x, n.z);
      this.facingYawValue = I(this.facingYawValue, m, this.config.turnSpeed * s);
    }
    const p = {
      x: n.x * g,
      y: r.y,
      z: n.z * g
    };
    this.groundedValue && g > 0 && this.tryStep(n);
    let c = this.calculateVelocity(s, r, p, o);
    this.jumpBufferRemaining > 0 && this.coyoteRemaining > 0 ? (c.y = this.config.jumpSpeed, this.jumpBufferRemaining = 0, this.coyoteRemaining = 0, this.groundedValue = !1, this.events.emit("jumped", void 0)) : this.groundedValue ? c.y < 0 && (c.y = 0) : c.y = Math.max(-this.config.terminalVelocity, c.y - this.config.gravity * s);
    const y = this.fallingValue;
    return this.fallingValue = !this.groundedValue && c.y <= 0, this.fallTimeValue = this.fallingValue ? this.fallTimeValue + s : 0, !y && this.fallingValue && this.events.emit("fallStarted", { fromLedge: this.nearLedgeValue }), this.physics.setVelocity(c), this.physics.integrate(s, o, { x: 0, y: -this.config.gravity, z: 0 }), !a && this.groundedValue && this.events.emit("landed", { velocity: r.y }), this.snapshot();
  }
  addImpulse(t) {
    this.assertActive();
    const e = this.physics.getVelocity();
    this.physics.setVelocity({
      x: e.x + t.x,
      y: e.y + t.y,
      z: e.z + t.z
    }), t.y > 0 && (this.groundedValue = !1, this.coyoteRemaining = 0);
  }
  teleport(t, e = !1) {
    this.assertActive(), this.physics.setPosition(t), e || this.physics.setVelocity({ x: 0, y: 0, z: 0 }), this.groundedValue = !1, this.slidingValue = !1, this.coyoteRemaining = 0, this.stepMovementDebt = 0;
  }
  snapshot() {
    return {
      position: C(this.physics.getPosition()),
      velocity: C(this.physics.getVelocity()),
      grounded: this.groundedValue,
      sliding: this.slidingValue,
      stance: this.stanceValue,
      facingYaw: this.facingYawValue,
      horizontalSpeed: D(this.physics.getVelocity()),
      nearLedge: this.nearLedgeValue,
      ledgeDrop: this.ledgeDropValue,
      falling: this.fallingValue,
      fallTime: this.fallTimeValue,
      supportYawDelta: this.supportYawDeltaValue
    };
  }
  dispose() {
    this.disposed || (this.disposed = !0, this.events.clear(), this.physics.dispose());
  }
  calculateVelocity(t, e, s, n) {
    if (this.groundedValue) {
      this.physics.maxAcceleration = D(s) > 1e-5 ? this.config.groundAcceleration : this.config.groundBraking;
      const r = k(s), h = Math.abs(r.x) + Math.abs(r.z) > 1e-6 ? r : { x: 0, y: 0, z: 1 };
      return this.physics.calculateMovement(
        t,
        h,
        n.averageSurfaceNormal,
        e,
        n.averageSurfaceVelocity,
        s,
        Z
      );
    }
    const a = e.y <= 0 ? this.config.fallingAirControlMultiplier : 1, o = this.config.airAcceleration * a * t;
    return {
      x: T(e.x, s.x, o),
      y: e.y,
      z: T(e.z, s.z, o)
    };
  }
  /** Resolve a low vertical obstruction by sampling its walkable top and lifting the capsule. */
  tryStep(t) {
    if (this.config.maxStepHeight <= 0) return !1;
    const e = this.physics.getPosition(), s = this.heightFor(this.stanceValue), n = e.y - s * 0.5, a = this.config.radius + this.physics.keepDistance + 0.01, o = a + this.config.stepProbeDistance, r = n + this.config.maxStepHeight + this.config.stepSkin, h = { x: -t.z, z: t.x }, l = this.config.radius * 0.65;
    for (const d of [0, l, -l]) {
      const u = h.x * d, g = h.z * d, p = {
        x: e.x + t.x * a + u,
        y: n + this.config.stepSkin,
        z: e.z + t.z * a + g
      }, c = {
        x: e.x + t.x * o + u,
        y: p.y,
        z: e.z + t.z * o + g
      }, y = S(this.world, p, c);
      if (!y.hasHit || y.hitNormal.y >= this.physics.maxSlopeCosine) continue;
      const m = { x: p.x, y: r, z: p.z }, R = { x: c.x, y: r, z: c.z };
      if (S(this.world, m, R).hasHit) continue;
      const V = { x: c.x, y: r, z: c.z }, w = { x: c.x, y: n - this.config.stepSkin, z: c.z }, f = S(this.world, V, w);
      if (!f.hasHit || f.hitNormal.y < this.physics.maxSlopeCosine) continue;
      const x = f.hitPoint.y - n;
      if (x <= this.config.stepSkin || x > this.config.maxStepHeight) continue;
      const v = Math.min(
        this.config.stepProbeDistance,
        Math.max(
          this.config.stepSkin,
          y.hitDistance + this.physics.keepDistance + this.config.stepSkin
        )
      );
      return this.physics.setPosition({
        x: e.x + t.x * v,
        y: e.y + x + this.config.stepSkin,
        z: e.z + t.z * v
      }), this.stepMovementDebt += v, A(this.physics), this.events.emit("stepped", { height: x }), !0;
    }
    return !1;
  }
  trySnapDown() {
    if (this.config.groundSnapDistance <= 0) return null;
    const t = this.physics.getPosition(), e = t.y - this.heightFor(this.stanceValue) * 0.5, s = { x: t.x, y: e + this.config.stepSkin, z: t.z }, n = { x: t.x, y: e - this.config.groundSnapDistance, z: t.z }, a = S(this.world, s, n);
    if (!a.hasHit || a.hitNormal.y < this.physics.maxSlopeCosine || a.hitNormal.y < 0.98) return null;
    const o = e - a.hitPoint.y;
    return o <= this.config.stepSkin || o > this.config.groundSnapDistance ? null : (this.physics.setPosition({ x: t.x, y: t.y - o + this.config.stepSkin, z: t.z }), A(this.physics), this.events.emit("snappedDown", { distance: o }), {
      isSurfaceDynamic: !1,
      supportedState: B.SUPPORTED,
      averageSurfaceNormal: a.hitNormal,
      averageSurfaceVelocity: { x: 0, y: 0, z: 0 },
      averageAngularSurfaceVelocity: { x: 0, y: 0, z: 0 }
    });
  }
  updateLedge(t) {
    let e = !1, s = null;
    if (t && D(t) > 1e-5) {
      const n = this.physics.getPosition(), a = n.y - this.heightFor(this.stanceValue) * 0.5, o = this.config.radius + this.config.ledgeProbeDistance, r = {
        x: n.x + t.x * o,
        y: a + this.config.stepSkin,
        z: n.z + t.z * o
      }, h = { x: r.x, y: r.y - this.config.ledgeProbeDepth, z: r.z }, l = S(this.world, r, h);
      l.hasHit && l.hitNormal.y >= this.physics.maxSlopeCosine ? (s = Math.max(0, a - l.hitPoint.y), e = s >= this.config.ledgeMinDrop) : e = !0;
    }
    e !== this.nearLedgeValue && this.events.emit(e ? "ledgeEntered" : "ledgeExited", e ? { drop: s } : void 0), this.nearLedgeValue = e, this.ledgeDropValue = e ? s : null;
  }
  hasExpansionClearance(t, e, s) {
    const n = e - t;
    if (n <= 0) return !0;
    const a = this.physics.getPosition(), o = a.y + t * 0.5, r = o + this.config.clearanceSkin, h = o + n + this.config.clearanceSkin, l = s * 0.72;
    return [
      [0, 0],
      [l, 0],
      [-l, 0],
      [0, l],
      [0, -l]
    ].every(([u, g]) => !S(
      this.world,
      { x: a.x + u, y: r, z: a.z + g },
      { x: a.x + u, y: h, z: a.z + g }
    ).hasHit);
  }
  updateStance(t) {
    const e = t ? "crouching" : "standing";
    if (e === this.stanceValue) return;
    const s = this.heightFor(this.stanceValue), n = this.heightFor(e);
    n > s && !(this.clearanceTest ? this.clearanceTest(s, n, this.config.radius) : this.hasExpansionClearance(s, n, this.config.radius)) || (O(this.physics, s, n, this.config.radius), this.stanceValue = e, this.groundedValue = !1, this.events.emit("stanceChanged", { stance: e }));
  }
  heightFor(t) {
    return t === "standing" ? this.config.standingHeight : this.config.crouchingHeight;
  }
  modeSpeed(t) {
    return this.stanceValue === "crouching" ? t ? this.config.crouchSprintSpeed : this.config.crouchSpeed : t ? this.config.sprintSpeed : this.config.walkSpeed;
  }
  followAnimatedSupport() {
    const t = this.groundedValue ? q(this.physics) : void 0;
    if (!t) {
      this.animatedSupportBody = void 0, this.animatedSupportPosition = void 0, this.animatedSupportRotation = void 0;
      return;
    }
    const e = t.node.position, s = C(e), n = t.node.rotationQuaternion, a = {
      x: n.x,
      y: n.y,
      z: n.z,
      w: n.w
    };
    if (t === this.animatedSupportBody && this.animatedSupportPosition && this.animatedSupportRotation) {
      const o = this.physics.getPosition(), r = this.animatedSupportRotation, h = G(a, {
        x: -r.x,
        y: -r.y,
        z: -r.z,
        w: r.w
      }), l = {
        x: o.x - this.animatedSupportPosition.x,
        y: o.y - this.animatedSupportPosition.y,
        z: o.z - this.animatedSupportPosition.z
      }, d = Q(l, h), u = W(h);
      this.supportYawDeltaValue = u, this.facingYawValue = $(this.facingYawValue + u), this.physics.setPosition({
        x: s.x + d.x,
        y: s.y + d.y,
        z: s.z + d.z
      });
    }
    this.animatedSupportBody = t, this.animatedSupportPosition = s, this.animatedSupportRotation = a;
  }
  applyPhysicsConfig() {
    this.physics.maxSlopeCosine = Math.cos(this.config.maxSlopeDegrees * Math.PI / 180), this.physics.maxAcceleration = this.config.groundAcceleration, this.physics.acceleration = 1, this.physics.characterStrength = this.config.characterStrength, this.physics.characterMass = this.config.characterMass;
  }
  assertActive() {
    if (this.disposed) throw new Error("LiteCharacterController has been disposed");
  }
}
function G(i, t) {
  return {
    x: i.w * t.x + i.x * t.w + i.y * t.z - i.z * t.y,
    y: i.w * t.y - i.x * t.z + i.y * t.w + i.z * t.x,
    z: i.w * t.z + i.x * t.y - i.y * t.x + i.z * t.w,
    w: i.w * t.w - i.x * t.x - i.y * t.y - i.z * t.z
  };
}
function Q(i, t) {
  const e = { x: t.x, y: t.y, z: t.z }, s = 2 * (e.y * i.z - e.z * i.y), n = 2 * (e.z * i.x - e.x * i.z), a = 2 * (e.x * i.y - e.y * i.x);
  return {
    x: i.x + t.w * s + e.y * a - e.z * n,
    y: i.y + t.w * n + e.z * s - e.x * a,
    z: i.z + t.w * a + e.x * n - e.y * s
  };
}
function W(i) {
  return Math.atan2(
    2 * (i.w * i.y + i.x * i.z),
    1 - 2 * (i.y * i.y + i.z * i.z)
  );
}
function $(i) {
  return Math.atan2(Math.sin(i), Math.cos(i));
}
function st(i, t, e) {
  const s = -Math.cos(e), n = -Math.sin(e), a = -Math.sin(e), o = Math.cos(e);
  return k({
    x: a * i + s * t,
    z: o * i + n * t
  });
}
const J = Object.freeze({
  targetHeight: 0.35,
  horizontalDamping: 14,
  verticalDamping: 8,
  lookAheadDistance: 0.8,
  lookAheadSpeed: 5,
  collisionPadding: 0.2,
  collisionStartOffset: 0.55,
  minimumRadius: 1.2,
  collisionDamping: 15,
  recoveryDamping: 7,
  firstPersonRadius: 0.05,
  firstPersonStandingEyeHeight: 0.65,
  firstPersonCrouchingEyeHeight: 0.35,
  firstPersonNearPlane: 0.03,
  modeTransitionDamping: 10,
  firstPersonTargetDamping: 60
});
class nt {
  constructor(t, e, s = {}) {
    this.camera = t, this.world = e, this.config = { ...J, ...s }, this.desiredRadius = t.radius, this.lastAppliedRadius = t.radius, this.thirdPersonNearPlane = t.nearPlane;
  }
  camera;
  world;
  config;
  desiredRadius;
  lastAppliedRadius;
  obstructedValue = !1;
  modeValue = "thirdPerson";
  modeBlendValue = 0;
  thirdPersonNearPlane;
  get obstructed() {
    return this.obstructedValue;
  }
  get requestedRadius() {
    return this.desiredRadius;
  }
  get mode() {
    return this.modeValue;
  }
  get firstPersonBlend() {
    return this.modeBlendValue;
  }
  setMode(t) {
    t !== this.modeValue && (t === "firstPerson" && (this.desiredRadius = this.camera.radius), this.modeValue = t);
  }
  toggleMode() {
    const t = this.modeValue === "thirdPerson" ? "firstPerson" : "thirdPerson";
    return this.setMode(t), t;
  }
  update(t, e) {
    const s = Math.min(Math.max(t, 0), 0.1);
    if (s <= 0) return;
    this.modeValue === "thirdPerson" && Math.abs(this.camera.radius - this.lastAppliedRadius) > 1e-5 && (this.desiredRadius = this.camera.radius);
    const n = this.modeValue === "firstPerson" ? 1 : 0;
    this.modeBlendValue += (n - this.modeBlendValue) * P(this.config.modeTransitionDamping, s), this.camera.nearPlane = z(this.thirdPersonNearPlane, this.config.firstPersonNearPlane, this.modeBlendValue), this.camera.alpha -= e.supportYawDelta * this.modeBlendValue;
    const a = e.horizontalSpeed, o = Math.min(1, a / Math.max(this.config.lookAheadSpeed, 1e-5)), r = this.config.lookAheadDistance * o * (1 - this.modeBlendValue), h = a > 1e-5 ? e.velocity.x / a * r : 0, l = a > 1e-5 ? e.velocity.z / a * r : 0, d = K(this.camera.alpha, this.camera.beta), u = e.stance === "crouching" ? this.config.firstPersonCrouchingEyeHeight : this.config.firstPersonStandingEyeHeight, g = {
      x: e.position.x + h,
      y: e.position.y + this.config.targetHeight,
      z: e.position.z + l
    }, p = {
      x: e.position.x - d.x * this.camera.radius,
      y: e.position.y + u - d.y * this.camera.radius,
      z: e.position.z - d.z * this.camera.radius
    }, c = this.modeBlendValue > 0.99 ? p : {
      x: z(g.x, p.x, this.modeBlendValue),
      y: z(g.y, p.y, this.modeBlendValue),
      z: z(g.z, p.z, this.modeBlendValue)
    };
    if (this.modeBlendValue > 0.99)
      this.camera.target.x = c.x, this.camera.target.y = c.y, this.camera.target.z = c.z;
    else {
      const V = z(this.config.horizontalDamping, this.config.firstPersonTargetDamping, this.modeBlendValue), w = z(this.config.verticalDamping, this.config.firstPersonTargetDamping, this.modeBlendValue), f = P(V, s), x = P(w, s);
      this.camera.target.x += (c.x - this.camera.target.x) * f, this.camera.target.y += (c.y - this.camera.target.y) * x, this.camera.target.z += (c.z - this.camera.target.z) * f;
    }
    let y = this.desiredRadius;
    if (this.obstructedValue = !1, this.modeBlendValue < 0.99) {
      const V = H(this.camera.target, d, this.config.collisionStartOffset), w = H(this.camera.target, d, this.desiredRadius), f = S(this.world, V, w);
      if (this.obstructedValue = f.hasHit, f.hasHit) {
        const x = tt(this.camera.target, f.hitPoint);
        y = Math.max(this.config.minimumRadius, x - this.config.collisionPadding);
      }
    }
    const m = z(y, this.config.firstPersonRadius, this.modeBlendValue), R = this.obstructedValue ? this.config.collisionDamping : this.config.recoveryDamping;
    this.camera.radius += (m - this.camera.radius) * P(R, s), this.lastAppliedRadius = this.camera.radius, this.modeBlendValue > 0.99 && (this.camera.target.x = e.position.x - d.x * this.camera.radius, this.camera.target.y = e.position.y + u - d.y * this.camera.radius, this.camera.target.z = e.position.z - d.z * this.camera.radius);
  }
}
function z(i, t, e) {
  return i + (t - i) * e;
}
function P(i, t) {
  return 1 - Math.exp(-Math.max(0, i) * t);
}
function K(i, t) {
  const e = Math.sin(t);
  return {
    x: Math.cos(i) * e,
    y: Math.cos(t),
    z: Math.sin(i) * e
  };
}
function H(i, t, e) {
  return {
    x: i.x + t.x * e,
    y: i.y + t.y * e,
    z: i.z + t.z * e
  };
}
function tt(i, t) {
  return Math.hypot(i.x - t.x, i.y - t.y, i.z - t.z);
}
export {
  F as DEFAULT_LITE_CC_CONFIG,
  J as DEFAULT_LITE_FOLLOW_CAMERA_CONFIG,
  it as LiteCharacterController,
  nt as LiteFollowCamera,
  U as assertLiteInternals,
  st as cameraRelativeMove,
  A as resetCharacterContacts,
  O as resizeCharacterCapsule,
  N as resolveConfig
};
//# sourceMappingURL=litecc.js.map
