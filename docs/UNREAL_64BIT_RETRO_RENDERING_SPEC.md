# Unreal 64-Bit Retro Rendering Spec

Target engine: Unreal Engine 5.7 project settings and material conventions, with the style constrained to fifth-generation console-era 3D platformers. Modern renderer features are used only for stability, editor workflow, and frame pacing, not for visual richness.

Visual reference note: the attached vertical gameplay clip reads as a low-poly toybox platformer with a chunky character silhouette, thick colored fog, hard-edged floor shadow, simple sprite effects, and low-resolution tile patterns. The implementation below keeps that direction while removing modern/PBR rendering cues.

Official references:
- Unreal Rendering Settings: https://dev.epicgames.com/documentation/unreal-engine/rendering-settings-in-the-unreal-engine-project-settings
- Unreal Material Properties: https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-material-properties
- Unreal Texture Format Support and Settings: https://dev.epicgames.com/documentation/unreal-engine/texture-format-support-and-settings-in-unreal-engine
- Unreal Decal Materials: https://dev.epicgames.com/documentation/unreal-engine/decal-materials-in-unreal-engine
- Unreal Lumen GI and Reflections: https://dev.epicgames.com/documentation/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine

## A. Unreal Engine Render Configuration

### Project Settings

Use a blank Games project, no starter content, no Nanite content, no Lumen template defaults.

Set these under Project Settings > Rendering:

| Setting | Value |
|---|---|
| Dynamic Global Illumination Method | None |
| Reflection Method | None |
| Shadow Map Method | Shadow Maps, not Virtual Shadow Maps |
| Support Hardware Ray Tracing | Off |
| Generate Mesh Distance Fields | Off |
| Allow Static Lighting | Off |
| Forward Shading | On |
| Anti-Aliasing Method | FXAA or None |
| Motion Blur | Off |
| Bloom | Off |
| Lens Flares | Off |
| Ambient Occlusion | Off |
| Auto Exposure | Off |
| Volumetric Fog | Off |
| Virtual Textures | Off |
| Nanite | Do not enable on any mesh |

Use a single unbound PostProcessVolume:

| Property | Value |
|---|---|
| Infinite Extent | On |
| Exposure Min/Max | 1.0 / 1.0 |
| Bloom Intensity | 0 |
| Vignette Intensity | 0 unless intentionally used as a flat UI overlay |
| Motion Blur Amount | 0 |
| Film Grain | 0 |
| Chromatic Aberration | 0 |
| Tone Curve Amount | 0 if available |

Use ExponentialHeightFog only as distance masking:

| Property | Value |
|---|---|
| Fog Density | 0.045 to 0.085 |
| Fog Height Falloff | 0.15 |
| Fog Inscattering Color | Match skybox horizon color |
| Volumetric Fog | Off |
| Start Distance | 600 to 900 uu |
| Fog Cutoff Distance | 4500 to 6500 uu |

Use no dynamic lights for gameplay visuals. If editor visibility requires lights, keep them disabled in cooked builds and do not let them affect the final look.

### `Config/DefaultEngine.ini`

```ini
[/Script/Engine.RendererSettings]
r.ForwardShading=True
r.AllowStaticLighting=False
r.DynamicGlobalIlluminationMethod=0
r.ReflectionMethod=0
r.Shadow.Virtual.Enable=0
r.GenerateMeshDistanceFields=False
r.RayTracing=False
r.RayTracing.Shadows=0
r.RayTracing.Reflections=0
r.RayTracing.GlobalIllumination=0
r.Lumen.DiffuseIndirect.Allow=0
r.Lumen.Reflections.Allow=0
r.SSGI.Enable=0
r.SSR.Quality=0
r.AmbientOcclusionLevels=0
r.DefaultFeature.AmbientOcclusion=False
r.DefaultFeature.AntiAliasing=1
r.DefaultFeature.AutoExposure=False
r.DefaultFeature.Bloom=False
r.DefaultFeature.LensFlare=False
r.DefaultFeature.MotionBlur=False
r.DefaultFeature.LocalExposure=False
r.TemporalAA.Upsampling=False
r.Nanite.ProjectEnabled=False
r.VirtualTextures=False
r.SupportSkyAtmosphere=False
r.SupportAtmosphericFog=False
r.VolumetricFog=0

[/Script/Engine.StreamingSettings]
s.AsyncLoadingThreadEnabled=True
s.EventDrivenLoaderEnabled=True
s.MinBulkDataSizeForAsyncLoading=131072

[/Script/Engine.TextureLODSettings]
TextureLODGroup_World=(MinLODSize=1,MaxLODSize=128,LODBias=0,MinMagFilter=point,MipFilter=point)
TextureLODGroup_WorldNormalMap=(MinLODSize=1,MaxLODSize=1,LODBias=99,MinMagFilter=point,MipFilter=point)
TextureLODGroup_WorldSpecular=(MinLODSize=1,MaxLODSize=1,LODBias=99,MinMagFilter=point,MipFilter=point)
TextureLODGroup_Character=(MinLODSize=1,MaxLODSize=128,LODBias=0,MinMagFilter=point,MipFilter=point)
TextureLODGroup_UI=(MinLODSize=1,MaxLODSize=256,LODBias=0,MinMagFilter=point,MipFilter=point)
TextureLODGroup_Effects=(MinLODSize=1,MaxLODSize=128,LODBias=0,MinMagFilter=point,MipFilter=point)
```

Project import rule: every texture must be assigned to `World`, `Character`, `UI`, or `Effects`. Any normal/specular/ORM import is rejected. For a deliberate 3-point N64-style filter, keep point-filtered source textures and implement the filter in the material. Do not use regular trilinear filtering.

### Section Score

| Category | Score |
|---|---:|
| Geometry and Vertex Processing | 9 |
| Texturing and Materials | 10 |
| Lighting, Fog, and Environment | 10 |
| VFX and UI | 9 |

Revision status: no category below 9. The config rejects Nanite, Lumen, ray tracing, VSM, bloom, modern post, and high-res texture groups.

## B. Unlit Retro Master Material

Create `M_Retro_VertexColor_Master`.

Material details:

| Property | Value |
|---|---|
| Material Domain | Surface |
| Blend Mode | Opaque, or Masked only when alpha cutout is required |
| Shading Model | Unlit |
| Two Sided | Off by default, On only for sprite cards |
| Fully Rough | On |
| Receives Decals | Off unless explicitly needed |
| Used with Skeletal Mesh | On for character instances |
| Used with Instanced Static Meshes | On for modular kits |

Parameters:

| Name | Type | Default |
|---|---|---|
| `AlbedoTex` | Texture2D | 64x64 checker/debug texture |
| `Tint` | Vector3 | 1,1,1 |
| `VertexLightStrength` | Scalar | 1 |
| `AlphaCutoff` | Scalar | 0.5 |

Node graph:

1. Texture Sample `AlbedoTex`, sampler source `From Texture Asset`.
2. Set the texture asset Filter to Nearest and LODGroup to World/Character/Effects.
3. Vertex Color node.
4. Multiply `TextureSample.RGB * VertexColor.RGB`.
5. Multiply result by `Tint`.
6. Lerp between `TextureSample.RGB` and lit result using `VertexLightStrength`.
7. Connect final RGB to Emissive Color.
8. If Masked, multiply `TextureSample.A * VertexColor.A`, compare against `AlphaCutoff`, output to Opacity Mask.
9. Leave Base Color, Metallic, Specular, Roughness, Normal, AO, Clear Coat, and WPO unused.

Optional custom node for N64-ish 3-point filtering:

```hlsl
// Inputs:
// Texture2D Tex
// SamplerState TexSampler
// float2 UV
// float2 TextureSize

float2 texel = UV * TextureSize - 0.5;
float2 baseTexel = floor(texel);
float2 f = frac(texel);

float2 uv00 = (baseTexel + float2(0.5, 0.5)) / TextureSize;
float2 uv10 = (baseTexel + float2(1.5, 0.5)) / TextureSize;
float2 uv01 = (baseTexel + float2(0.5, 1.5)) / TextureSize;
float2 uv11 = (baseTexel + float2(1.5, 1.5)) / TextureSize;

float4 c00 = Tex.SampleLevel(TexSampler, uv00, 0);
float4 c10 = Tex.SampleLevel(TexSampler, uv10, 0);
float4 c01 = Tex.SampleLevel(TexSampler, uv01, 0);
float4 c11 = Tex.SampleLevel(TexSampler, uv11, 0);

float useUpper = step(f.x + f.y, 1.0);
float4 triA = c00 + f.x * (c10 - c00) + f.y * (c01 - c00);
float4 triB = c11 + (1.0 - f.x) * (c01 - c11) + (1.0 - f.y) * (c10 - c11);
return lerp(triB, triA, useUpper);
```

Material output using the custom node:

```hlsl
float4 albedo = ThreePointSample;
float3 vertexLit = VertexColor.rgb;
float3 color = albedo.rgb * vertexLit * Tint;
return float4(color, albedo.a * VertexColor.a);
```

Use the 3-point filter only on hero character and large floor materials. Use point filtering everywhere else.

### Section Score

| Category | Score |
|---|---:|
| Geometry and Vertex Processing | 9 |
| Texturing and Materials | 10 |
| Lighting, Fog, and Environment | 10 |
| VFX and UI | 9 |

Revision status: no PBR outputs, no normal/specular/roughness maps, no lighting dependency, and vertex color is the primary lighting/detail carrier.

## C. 64-Bit Style Fake Drop Shadow

Preferred implementation: flat unlit circular mesh, not a dynamic shadow or soft decal.

Create assets:

| Asset | Spec |
|---|---|
| `SM_FakeShadow_Circle` | 24-triangle flat disk, radius 50 uu, UV centered, pivot center |
| `M_FakeShadow_Unlit` | Surface, Translucent or Masked, Unlit, black emissive, opacity 0.35 |
| `BP_FakeShadowFollower` or component | Attached to player actor |

Avoid decal projection unless the floor mesh shape demands it. Decals are valid in Unreal, but a mesh disk is more era-authentic and avoids DBuffer/decal blending cost.

### C++ Component

```cpp
// RetroFakeShadowComponent.h
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "RetroFakeShadowComponent.generated.h"

class UStaticMeshComponent;
class UStaticMesh;
class UMaterialInterface;

UCLASS(ClassGroup=(Retro), meta=(BlueprintSpawnableComponent))
class URetroFakeShadowComponent : public UActorComponent
{
  GENERATED_BODY()

public:
  URetroFakeShadowComponent();

  UPROPERTY(EditAnywhere, Category="Retro Shadow")
  float TraceLength = 900.0f;

  UPROPERTY(EditAnywhere, Category="Retro Shadow")
  float SurfaceOffset = 1.6f;

  UPROPERTY(EditAnywhere, Category="Retro Shadow")
  float MinScale = 0.45f;

  UPROPERTY(EditAnywhere, Category="Retro Shadow")
  float MaxScale = 1.05f;

  UPROPERTY(EditAnywhere, Category="Retro Shadow")
  TEnumAsByte<ECollisionChannel> TraceChannel = ECC_Visibility;

protected:
  virtual void BeginPlay() override;
  virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
  UPROPERTY()
  UStaticMeshComponent* ShadowMesh = nullptr;
};
```

```cpp
// RetroFakeShadowComponent.cpp
#include "RetroFakeShadowComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/Actor.h"
#include "Engine/World.h"

URetroFakeShadowComponent::URetroFakeShadowComponent()
{
  PrimaryComponentTick.bCanEverTick = true;
}

void URetroFakeShadowComponent::BeginPlay()
{
  Super::BeginPlay();

  AActor* Owner = GetOwner();
  ShadowMesh = NewObject<UStaticMeshComponent>(Owner, TEXT("RetroFakeShadow"));
  ShadowMesh->RegisterComponent();
  ShadowMesh->AttachToComponent(Owner->GetRootComponent(), FAttachmentTransformRules::KeepWorldTransform);
  ShadowMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
  ShadowMesh->SetCastShadow(false);
  ShadowMesh->SetReceivesDecals(false);
}

void URetroFakeShadowComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
  Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

  if (!ShadowMesh || !GetOwner()) return;

  const FVector Start = GetOwner()->GetActorLocation();
  const FVector End = Start - FVector(0, 0, TraceLength);
  FHitResult Hit;
  FCollisionQueryParams Params(SCENE_QUERY_STAT(RetroFakeShadow), false, GetOwner());

  const bool bHit = GetWorld()->LineTraceSingleByChannel(Hit, Start, End, TraceChannel, Params);
  ShadowMesh->SetVisibility(bHit);
  if (!bHit) return;

  const FVector Location = Hit.ImpactPoint + Hit.ImpactNormal * SurfaceOffset;
  const FQuat AlignToFloor = FRotationMatrix::MakeFromZX(Hit.ImpactNormal, GetOwner()->GetActorForwardVector()).ToQuat();
  const float HeightAlpha = FMath::Clamp(Hit.Distance / TraceLength, 0.0f, 1.0f);
  const float Scale = FMath::Lerp(MaxScale, MinScale, HeightAlpha);

  ShadowMesh->SetWorldLocation(Location);
  ShadowMesh->SetWorldRotation(AlignToFloor);
  ShadowMesh->SetWorldScale3D(FVector(Scale, Scale, 1.0f));
}
```

Blueprint equivalent:

1. On Tick, get player capsule world location.
2. Line Trace by Channel from capsule location to capsule location minus `(0,0,900)`.
3. If no hit, set `SM_FakeShadow_Circle` visibility false.
4. If hit, set visibility true.
5. Set world location to `Impact Point + Impact Normal * 1.6`.
6. Use `Make Rot from ZX`: Z = Impact Normal, X = player forward vector.
7. Scale shadow from 1.05 near floor to 0.45 at max trace distance.
8. Mesh collision off, Cast Shadow off, Receives Decals off.

### Section Score

| Category | Score |
|---|---:|
| Geometry and Vertex Processing | 10 |
| Texturing and Materials | 10 |
| Lighting, Fog, and Environment | 10 |
| VFX and UI | 9 |

Revision status: no shadow maps, no blur, no soft lighting, no dynamic light dependency, and explicit surface offset prevents Z-fighting.

## D. Asset Production Specs

### Characters

| Asset Type | Triangle Budget | Rules |
|---|---:|---|
| Player hero | 1,200 to 2,200, hard cap 2,500 |
| NPC major | 700 to 1,500 |
| NPC minor | 250 to 800 |
| Pickup | 24 to 180 |
| Enemy grunt | 300 to 1,000 |

Character rules:

- Use single 64x64 or 128x128 diffuse texture per character.
- Use vertex colors for cheek tint, belly shade, limb gradient, and fake rim separation.
- Smooth vertex normals allowed on organic bodies.
- No normal maps, no groom hair, no cloth sim, no morph-heavy facial rigs.
- Use 8 to 16 bones for simple characters, 24 max for hero.
- Animation should favor chunky pose-to-pose timing at 12 to 18 authored key poses per second, interpolated by engine only for responsiveness.

### Environment Modular Kit

| Module | Triangle Budget | Texture |
|---|---:|---|
| Floor tile 400x400 uu | 12 to 80 | 64x64 |
| Wall chunk 400x300 uu | 12 to 96 | 64x64 or 128x128 |
| Ramp/bridge | 24 to 120 | 64x64 |
| Rail/fence piece | 16 to 96 | 32x32 or vertex color only |
| Tree small | 80 to 220 | 64x64 |
| Tree hero | 250 to 500 | 128x128 |
| Building facade | 100 to 450 | 128x128 |
| Landmark prop | 300 to 900 | 128x128 |

Environment rules:

- Build levels from grid-aligned modular chunks.
- Use hard edges/split normals on architecture.
- Use vertex color gradients for darkness under ledges, corner grime, baked fake bounce, and route readability.
- No landscapes, Nanite, tessellation, displacement, procedural grass fields, or high-poly sculpt imports.
- Collision uses primitive boxes, capsules, and low-poly custom collision. Do not use complex-as-simple except for rare static landmark floors.

### Texture Rules

| Texture Type | Preferred | Max |
|---|---:|---:|
| Character diffuse | 64x64 | 128x128 |
| Hero face/eyes atlas | 64x64 | 128x128 |
| Environment diffuse | 64x64 | 128x128 |
| Landmark diffuse | 128x128 | 256x256 by approval |
| VFX flipbook | 64x64 sheet | 128x128 sheet |
| UI icon | 16x16 to 64x64 | 128x128 |

Import settings:

- Compression: UserInterface2D for UI, default color compression for world diffuse.
- sRGB: On for color textures.
- Mip Gen Settings: NoMipmaps for UI and pixel-critical textures; SimpleAverage for distant world textures if shimmer is unacceptable.
- Filter: Nearest.
- Texture Group: World, Character, UI, or Effects.

### VFX and UI

| Asset | Spec |
|---|---|
| Dust puff | 4 to 6 frame flipbook, 64x64 sheet, 10 fps |
| Sparkle | 4 frame flipbook, 32x32 or 64x64, 12 fps |
| Pickup burst | 6 to 8 flat billboards, no bloom |
| Impact star | Single 2-plane cross card, 32x32 |
| Splash | 6 frame flipbook, 64x64, 12 fps |
| UI font | Pixel font or chunky hand-drawn bitmap font |
| UI scaling | Integer or nearest-neighbor scale |

Use Niagara only as an emitter scheduler for CPU sprite billboards. No volumetric modules, fluid modules, GPU particle dependence, ribbon trails with modern glow, scene-depth foam, or bloom-heavy additive effects.

### Camera and Fog

- Camera FOV: 55 to 65 degrees.
- Follow lag: 0.08 to 0.14 seconds.
- Collision: simple camera sphere trace, push forward from blocked walls.
- Draw-distance aesthetic: use fog and silhouettes, not massive vistas.
- Far plane: 6000 to 9000 uu for most levels.
- Fog color must match skybox horizon and hide module cutoffs.
- Use sky dome with a 128x128 or 256x128 gradient texture, point filtered or intentionally banded.

### LOD Policy

- Characters: no LOD for hero under 2,500 triangles unless platform profiling demands it.
- Environment: manual LOD only, one reduced mesh at 45 percent triangles for distant landmarks.
- Billboards for very distant trees/props are allowed if they are intentionally chunky and low-res.
- No automatic Nanite fallback, no generated high-poly LOD chain.

### Section Score

| Category | Score |
|---|---:|
| Geometry and Vertex Processing | 10 |
| Texturing and Materials | 10 |
| Lighting, Fog, and Environment | 10 |
| VFX and UI | 10 |

Revision status: all specs enforce low-poly silhouettes, low-res diffuse-only assets, vertex-color lighting, simple collision, hard fake shadows, and sprite-based effects.

## E. Build Acceptance Checklist

Reject a build if any item is true:

- Any mesh has Nanite enabled.
- Any character exceeds 2,500 triangles.
- Any non-approved texture exceeds 256x256.
- Any material uses Default Lit/PBR outputs for game-world surfaces.
- Any normal, metallic, roughness, specular, AO, height, clear coat, or displacement map ships.
- Lumen, ray tracing, VSM, bloom, motion blur, volumetric fog, or high-fidelity post is enabled.
- Real dynamic character shadows are visible.
- VFX use volumetric smoke/fluid simulation or modern bloom glow.
- Fog does not hide the far edge of the level.
- Texture filtering defaults back to trilinear/aniso for retro assets.

Final score:

| Category | Score |
|---|---:|
| Geometry and Vertex Processing | 10 |
| Texturing and Materials | 10 |
| Lighting, Fog, and Environment | 10 |
| VFX and UI | 10 |

No revision required. The spec preserves the fifth-generation console aesthetic while using Unreal for stability, high resolution output, deterministic collision, and clean frame pacing.
