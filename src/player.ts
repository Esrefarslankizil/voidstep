import * as THREE from 'three';
import { CONFIG } from './config';
import { createEdgeTileTexture } from './textures';

export class Player {
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  glowEdges: THREE.LineSegments;
  halo: THREE.Sprite;
  velocityY = 0;
  isGrounded = true;
  alive = true;

  /** Dışarıdan her kare ayarlanan yatay girdi: -1 (sol), 0 (dur), 1 (sağ) */
  strafeInput = 0;
  currentStrafeSpeed = 0;
  prevY: number = CONFIG.PLAYER_START_Y;

  // Coyote Time & Jump Buffer
  private wasGrounded = true;
  private coyoteTimer = 0;
  private didJump = false;
  private jumpBufferTimer = 0;

  /** Zıplama, iniş ve iz bırakma olayları */
  justJumped = false;
  justLanded = false;
  shouldEmitTrail = false;
  private trailTimer = 0;

  /**
   * Boşluk geçişinde zıplanıp zıplanmadığını takip eder.
   * Eğer oyuncu boşluğu zıplamadan geçtiyse gapBonus artar,
   * zıplayarak geçtiyse yavaşça azalır.
   */
  hasJumpedThisGap = false;

  constructor(scene: THREE.Scene) {
    const size = CONFIG.PLAYER_SIZE;

    // ── 1. Ana Küp Gövdesi (EDGE ızgara dokusu) ──
    const geometry = new THREE.BoxGeometry(size, size, size);
    const tileTex = createEdgeTileTexture('#00f0ff', '#030814');
    const material = new THREE.MeshBasicMaterial({
      map: tileTex,
      color: 0xffffff,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, CONFIG.PLAYER_START_Y, 0);

    // ── 2. Keskin Dış Neon Kenarlar ──
    const edgesGeo = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 2,
    });
    this.edges = new THREE.LineSegments(edgesGeo, edgesMat);

    // ── 3. İkincil Yumuşak Neon Glow Kenarı ──
    const glowEdgesMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glowEdges = new THREE.LineSegments(edgesGeo, glowEdgesMat);
    this.glowEdges.scale.setScalar(1.04);

    // ── 4. Yumuşak Halo Işıması (Sprite) ──
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: Player.createHaloTexture(),
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.halo.scale.set(2.0, 2.0, 1);

    scene.add(this.mesh);
    scene.add(this.edges);
    scene.add(this.glowEdges);
    scene.add(this.halo);
  }

  private static createHaloTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, 'rgba(0, 240, 255, 0.6)');
    grad.addColorStop(0.6, 'rgba(0, 240, 255, 0.15)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }

  jump(): void {
    if (!this.alive) return;

    const canJump = this.isGrounded || this.coyoteTimer > 0;

    if (canJump) {
      this.velocityY = CONFIG.JUMP_FORCE;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.didJump = true;
      this.jumpBufferTimer = 0;
      this.justJumped = true;
      this.hasJumpedThisGap = true;

      // Telefondaysa titreşim tetikle (haptic feedback)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(20);
        } catch (_) {
          // Desteklenmiyorsa sessizce geç
        }
      }
    } else {
      this.jumpBufferTimer = CONFIG.JUMP_BUFFER_TIME;
    }
  }

  update(dt: number, currentSpeed: number): void {
    if (!this.alive) return;

    // Olay bayraklarını sıfırla
    this.justJumped = false;
    this.justLanded = false;
    this.shouldEmitTrail = false;

    // Mini küp izi zamanlayıcısı
    this.trailTimer += dt;
    if (this.trailTimer >= 0.07) {
      this.trailTimer = 0;
      this.shouldEmitTrail = true;
    }

    // Zamanlayıcılar
    if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;

    // İleri hareket (mesafeye göre artan hız ile)
    this.mesh.position.z -= currentSpeed * dt;

    // Yumuşak ama tepkili yan ivmelenme (~0.08 sn)
    const targetStrafeSpeed = this.strafeInput * CONFIG.STRAFE_SPEED;
    this.currentStrafeSpeed = THREE.MathUtils.lerp(
      this.currentStrafeSpeed,
      targetStrafeSpeed,
      CONFIG.STRAFE_ACCEL_LERP
    );
    this.mesh.position.x += this.currentStrafeSpeed * dt;
    this.mesh.position.x = Math.max(-CONFIG.PLAYER_MAX_X,
      Math.min(CONFIG.PLAYER_MAX_X, this.mesh.position.x));

    // Yerçekimi öncesi Y pozisyonunu kaydet (Tunneling engeli)
    this.prevY = this.mesh.position.y;

    // Yerçekimi
    this.velocityY += CONFIG.GRAVITY * dt;
    this.mesh.position.y += this.velocityY * dt;

    // Durum kaydet & sıfırla
    this.wasGrounded = this.isGrounded;
    this.isGrounded = false;

    // Pozisyon senkronizasyonu
    this.edges.position.copy(this.mesh.position);
    this.glowEdges.position.copy(this.mesh.position);
    this.halo.position.copy(this.mesh.position);

    // EDGE tarzı yuvarlanma animasyonu
    if (!this.wasGrounded) {
      this.mesh.rotation.x -= dt * 4.5;
    } else {
      this.mesh.rotation.x *= 0.8;
    }

    // Sağa/sola kayarken hafif yatma
    const targetRotZ = -this.strafeInput * 0.18;
    this.mesh.rotation.z += (targetRotZ - this.mesh.rotation.z) * 0.2;

    this.edges.rotation.copy(this.mesh.rotation);
    this.glowEdges.rotation.copy(this.mesh.rotation);

    // Halo nabız efekti
    const pulse = 0.2 + Math.sin(Date.now() * 0.006) * 0.08;
    (this.halo.material as THREE.SpriteMaterial).opacity = pulse;
  }

  postCollision(): void {
    // Coyote time: platformdan ayrılınca (zıplamamışsa)
    if (this.wasGrounded && !this.isGrounded && !this.didJump) {
      this.coyoteTimer = CONFIG.COYOTE_TIME;
    }

    // Jump buffer: yere temas anında bekleyen zıplama
    if (this.isGrounded && this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = 0;
      this.jump();
    }

    // İniş algılama
    if (this.isGrounded && !this.wasGrounded) {
      this.justLanded = true;
    }

    // Yerdeyken dik pozisyon
    if (this.isGrounded) {
      this.mesh.rotation.x = 0;
      this.edges.rotation.x = 0;
      this.glowEdges.rotation.x = 0;
    }

    this.didJump = false;
  }

  getBounds() {
    const p = this.mesh.position;
    const half = CONFIG.PLAYER_SIZE / 2;
    return {
      minX: p.x - half,
      maxX: p.x + half,
      minY: p.y - half,
      maxY: p.y + half,
      minZ: p.z - half,
      maxZ: p.z + half,
    };
  }

  reset(): void {
    this.mesh.position.set(0, CONFIG.PLAYER_START_Y, 0);
    this.prevY = CONFIG.PLAYER_START_Y;
    this.mesh.rotation.set(0, 0, 0);
    this.edges.rotation.set(0, 0, 0);
    this.glowEdges.rotation.set(0, 0, 0);
    this.velocityY = 0;
    this.isGrounded = true;
    this.wasGrounded = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.didJump = false;
    this.strafeInput = 0;
    this.currentStrafeSpeed = 0;
    this.alive = true;
    this.justJumped = false;
    this.justLanded = false;
    this.shouldEmitTrail = false;
    this.trailTimer = 0;
    this.hasJumpedThisGap = false;
  }
}
