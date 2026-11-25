import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  MathUtils,
  type Color,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
} from "three";
import { addShaderHook, type ShaderHook } from "../jacket/shaderHooks";

const FONT_FAMILY = '"Inter Tight"';

type Wordmark3DProps = {
  text: string;
  /** Width of the lettering in world units. */
  width: number;
  position: [number, number, number];
  /** Colour of the letters (a shade of the wall, for low contrast). */
  color: string;
  /** Peak opacity. */
  opacity: number;
  /** Scroll progress + the range over which the wordmark fades out. */
  scroll?: RefObject<number>;
  fadeOut: readonly [number, number];
  /** Optional range over which it fades in first (chapter words). */
  fadeIn?: readonly [number, number];
  /**
   * Live colour (e.g. a shade of the current backdrop), followed every
   * frame; `color` is then only the starting value.
   */
  tone?: RefObject<Color>;
  /** Font weight (default light 300) and letter spacing (default 0.18em). */
  weight?: number;
  tracking?: string;
  /** Lights the letters like the wall they're on (the studio's light). */
  lightHook?: ShaderHook;
  /**
   * Relief: a soft shadow just behind the letters, offset down along the
   * key light, in this (live) colour — so they stand off the wall like
   * built letters rather than print. (Real shadows can't do it: the
   * letters hang well in front of the wall, so theirs land far below.)
   */
  relief?: RefObject<Color>;
};

/**
 * A large, quiet wordmark painted on the studio's back wall. It lives in
 * the 3D scene, so it is lit like the wall and has true parallax with
 * the camera — depth a flat HTML layer can't give.
 */
export default function Wordmark3D({
  text,
  width,
  position,
  color,
  opacity,
  scroll,
  fadeOut,
  fadeIn,
  tone,
  weight = 300,
  tracking = "0.18em",
  lightHook,
  relief,
}: Wordmark3DProps) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshStandardMaterial>(null);
  useLayoutEffect(() => {
    // (Its own key: the words' variant of the light compiles differently.)
    if (lightHook && material.current) addShaderHook(material.current, "fidelio-wall-words-light", lightHook);
  }, [lightHook]);

  // Paint with the site's typeface once it has loaded (a canvas can't
  // swap fonts later like HTML does).
  const [fontReady, setFontReady] = useState(() => document.fonts.check(`${weight} 64px ${FONT_FAMILY}`));
  useEffect(() => {
    if (fontReady) return;
    let live = true;
    document.fonts
      .load(`${weight} 64px ${FONT_FAMILY}`)
      .catch(() => undefined)
      .then(() => live && setFontReady(true));
    return () => {
      live = false;
    };
  }, [fontReady, weight]);

  const { texture, aspect } = useMemo(() => {
    const height = 256;
    const probe = document.createElement("canvas").getContext("2d")!;
    const font = `${weight} ${height * 0.78}px ${fontReady ? FONT_FAMILY : "Arial"}, "Helvetica Neue", Arial, sans-serif`;
    probe.font = font;
    (probe as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = tracking;
    const w = Math.ceil(probe.measureText(text).width + height * 0.4);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = height;
    const ctx = c.getContext("2d")!;
    ctx.font = font;
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = tracking;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2 + height * 0.07, height / 2 + height * 0.04);
    const t = new CanvasTexture(c);
    t.anisotropy = 4;
    return { texture: t, aspect: w / height };
  }, [text, fontReady, weight, tracking]);
  useEffect(() => () => texture.dispose(), [texture]);

  // The relief shadow: the same letters, softly blurred.
  const shadowTexture = useMemo(() => {
    if (!relief) return null;
    const src = texture.image as HTMLCanvasElement;
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext("2d")!;
    // On black: an alphaMap reads the green channel, so it must carry
    // the coverage (white-on-transparent would read as solid).
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.filter = `blur(${Math.round(src.height * 0.05)}px)`;
    ctx.drawImage(src, 0, 0);
    return new CanvasTexture(c);
  }, [relief, texture]);
  useEffect(() => () => shadowTexture?.dispose(), [shadowTexture]);
  const shadowMesh = useRef<Mesh>(null);
  const height = width / aspect;

  useFrame(() => {
    const material = mesh.current?.material as MeshStandardMaterial | undefined;
    if (!material) return;
    const p = scroll?.current ?? 0;
    const [a, b] = fadeOut;
    const t = MathUtils.clamp((p - a) / (b - a), 0, 1);
    const shown = fadeIn ? MathUtils.clamp((p - fadeIn[0]) / (fadeIn[1] - fadeIn[0]), 0, 1) : 1;
    material.opacity = opacity * shown * (1 - t);
    if (tone?.current) material.color.copy(tone.current);
    mesh.current!.visible = material.opacity > 0.002;
    const shadow = shadowMesh.current;
    if (shadow) {
      const m = shadow.material as MeshBasicMaterial;
      m.opacity = 0.42 * (material.opacity / Math.max(opacity, 1e-3));
      if (relief?.current) m.color.copy(relief.current);
      shadow.visible = mesh.current!.visible;
    }
  });

  return (
    <>
      {shadowTexture && (
        // Offset down (the key light is high in front) and a hair behind.
        <mesh
          ref={shadowMesh}
          position={[position[0] + height * 0.015, position[1] - height * 0.05, position[2] - 0.01]}
          renderOrder={0}
        >
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial alphaMap={shadowTexture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh ref={mesh} position={position} receiveShadow renderOrder={1}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          ref={material}
          color={color}
          alphaMap={texture}
          transparent
          opacity={opacity}
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
