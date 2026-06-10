import { FrameInput } from "../types";

type TouchAction = "jump" | "dash" | "interact" | "pause";

const keyBindings = {
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  jump: ["Space"],
  dash: ["ShiftLeft", "ShiftRight", "KeyK"],
  interact: ["KeyE", "KeyJ", "Enter"],
  pause: ["Escape"],
  camLeft: ["KeyQ"],
  camRight: ["KeyR"]
};

export class InputController {
  private readonly heldKeys = new Set<string>();
  private readonly previousKeys = new Set<string>();
  private readonly touchHeld = new Set<TouchAction>();
  private readonly touchPressed = new Set<TouchAction>();
  private pointerLookX = 0;
  private isPointerLooking = false;
  private lastPointerX = 0;
  private previousGamepadButtons: boolean[] = [];
  private stick = { x: 0, y: 0 };
  private stickPointerId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private debugState = {
    jumpHeldSource: "",
    jumpPressedSource: "",
    heldKeys: "",
    touchHeld: "",
    touchPressed: "",
    gamepad: ""
  };

  constructor(private readonly root: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    root.addEventListener("pointerdown", this.onPointerDown);
    root.addEventListener("pointermove", this.onPointerMove);
    root.addEventListener("pointerup", this.onPointerUp);
    root.addEventListener("pointercancel", this.onPointerUp);
    root.addEventListener("contextmenu", this.preventContextMenu);
  }

  snapshot(): FrameInput {
    const gamepad = this.readGamepad();
    const keyMoveX = Number(this.anyHeld(keyBindings.right)) - Number(this.anyHeld(keyBindings.left));
    const keyMoveY = Number(this.anyHeld(keyBindings.forward)) - Number(this.anyHeld(keyBindings.back));
    const moveX = clampAxis(keyMoveX + this.stick.x + gamepad.moveX);
    const moveY = clampAxis(keyMoveY + -this.stick.y + gamepad.moveY);
    const keyJumpHeld = this.anyHeld(keyBindings.jump);
    const touchJumpHeld = this.touchHeld.has("jump");
    const touchJumpPressed = this.consumeTouchPress("jump");
    const keyJumpPressed = this.anyPressed(keyBindings.jump);
    const jump = keyJumpHeld || touchJumpHeld || gamepad.jump;
    const jumpPressed = keyJumpPressed || touchJumpPressed || gamepad.jumpPressed;

    this.debugState = {
      jumpHeldSource: keyJumpHeld ? "key" : touchJumpHeld ? "touch" : gamepad.jump ? "gamepad" : "",
      jumpPressedSource: keyJumpPressed ? "key" : touchJumpPressed ? "touch" : gamepad.jumpPressed ? "gamepad" : "",
      heldKeys: Array.from(this.heldKeys).join(","),
      touchHeld: Array.from(this.touchHeld).join(","),
      touchPressed: Array.from(this.touchPressed).join(","),
      gamepad: gamepad.debug
    };

    const input: FrameInput = {
      moveX,
      moveY,
      cameraX:
        Number(this.anyHeld(keyBindings.camRight)) -
        Number(this.anyHeld(keyBindings.camLeft)) +
        gamepad.cameraX,
      jump,
      jumpPressed,
      dashPressed:
        this.anyPressed(keyBindings.dash) || this.consumeTouchPress("dash") || gamepad.dashPressed,
      interactPressed:
        this.anyPressed(keyBindings.interact) ||
        this.consumeTouchPress("interact") ||
        gamepad.interactPressed,
      pausePressed:
        this.anyPressed(keyBindings.pause) || this.consumeTouchPress("pause") || gamepad.pausePressed,
      pointerLookX: this.pointerLookX
    };

    this.pointerLookX = 0;
    this.previousKeys.clear();
    for (const key of this.heldKeys) {
      this.previousKeys.add(key);
    }

    return input;
  }

  reset(): void {
    this.heldKeys.clear();
    this.previousKeys.clear();
    this.touchHeld.clear();
    this.touchPressed.clear();
    this.pointerLookX = 0;
    this.isPointerLooking = false;
    this.stick = { x: 0, y: 0 };
    this.stickPointerId = null;
    this.previousGamepadButtons = this.currentGamepadButtons();
  }

  debugSnapshot() {
    return this.debugState;
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.root.removeEventListener("pointerdown", this.onPointerDown);
    this.root.removeEventListener("pointermove", this.onPointerMove);
    this.root.removeEventListener("pointerup", this.onPointerUp);
    this.root.removeEventListener("pointercancel", this.onPointerUp);
    this.root.removeEventListener("contextmenu", this.preventContextMenu);
  }

  private anyHeld(keys: string[]): boolean {
    return keys.some((key) => this.heldKeys.has(key));
  }

  private anyPressed(keys: string[]): boolean {
    return keys.some((key) => this.heldKeys.has(key) && !this.previousKeys.has(key));
  }

  private consumeTouchPress(action: TouchAction): boolean {
    const pressed = this.touchPressed.has(action);
    this.touchPressed.delete(action);
    return pressed;
  }

  private readGamepad() {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads.find(Boolean);
    if (!pad) {
      return {
        moveX: 0,
        moveY: 0,
        cameraX: 0,
        jump: false,
        jumpPressed: false,
        dashPressed: false,
        interactPressed: false,
        pausePressed: false,
        debug: ""
      };
    }

    const moveX = deadzone(pad.axes[0] ?? 0);
    const moveY = -deadzone(pad.axes[1] ?? 0);
    const cameraX = deadzone(pad.axes[2] ?? 0) * 0.95;

    const currentButtons = pad.buttons.map((button) => Boolean(button?.pressed));
    const result = {
      moveX,
      moveY,
      cameraX,
      jump: currentButtons[0] ?? false,
      jumpPressed: Boolean(currentButtons[0] && !this.previousGamepadButtons[0]),
      dashPressed: Boolean(currentButtons[1] && !this.previousGamepadButtons[1]),
      interactPressed: Boolean(currentButtons[2] && !this.previousGamepadButtons[2]),
      pausePressed: Boolean(currentButtons[9] && !this.previousGamepadButtons[9]),
      debug: `${pad.id}:${currentButtons.map((pressed, index) => (pressed ? String(index) : "")).filter(Boolean).join("|")}`
    };
    this.previousGamepadButtons = currentButtons;
    return result;
  }

  private currentGamepadButtons(): boolean[] {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads.find(Boolean);
    return pad ? pad.buttons.map((button) => Boolean(button?.pressed)) : [];
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (Object.values(keyBindings).flat().includes(event.code)) {
      event.preventDefault();
    }
    this.heldKeys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.heldKeys.delete(event.code);
  };

  private readonly onBlur = () => {
    this.reset();
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    const action = target.dataset.touchAction as TouchAction | undefined;
    if (action) {
      event.preventDefault();
      target.setPointerCapture(event.pointerId);
      this.touchHeld.add(action);
      this.touchPressed.add(action);
      return;
    }

    if (target.closest("[data-stick]")) {
      event.preventDefault();
      this.stickPointerId = event.pointerId;
      this.stickOrigin = { x: event.clientX, y: event.clientY };
      target.setPointerCapture(event.pointerId);
      return;
    }

    if (target.closest("button")) {
      return;
    }

    this.isPointerLooking = true;
    this.lastPointerX = event.clientX;
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (this.stickPointerId === event.pointerId) {
      const dx = event.clientX - this.stickOrigin.x;
      const dy = event.clientY - this.stickOrigin.y;
      this.stick = {
        x: clampAxis(dx / 54),
        y: clampAxis(dy / 54)
      };
      return;
    }

    if (!this.isPointerLooking) {
      return;
    }
    this.pointerLookX += (event.clientX - this.lastPointerX) * 0.004;
    this.lastPointerX = event.clientX;
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    const action = target.dataset.touchAction as TouchAction | undefined;
    if (action) {
      this.touchHeld.delete(action);
      return;
    }

    if (this.stickPointerId === event.pointerId) {
      this.stickPointerId = null;
      this.stick = { x: 0, y: 0 };
      return;
    }

    this.isPointerLooking = false;
  };

  private readonly preventContextMenu = (event: Event) => {
    event.preventDefault();
  };
}

const clampAxis = (value: number): number => Math.max(-1, Math.min(1, value));

const deadzone = (value: number): number => (Math.abs(value) < 0.18 ? 0 : value);
