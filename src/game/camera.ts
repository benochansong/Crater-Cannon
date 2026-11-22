import { HEIGHT, WIDTH, clamp } from "./engine";
import type { Projectile, Vec } from "./engine";
// A world transform independent of the HUD. Zooming out preserves both vehicles.
export class Camera {
  scale = 1;
  x = 0;
  y = 0;
  update(
    projectile: Pick<Projectile, "x" | "y" | "vy"> | null,
    dt: number,
    menu: boolean,
  ) {
    const futureY = projectile
      ? Math.min(
          projectile.y,
          projectile.y + projectile.vy * 0.35 + 110 * 0.35 ** 2,
        )
      : 0;
    const target =
      menu || !projectile
        ? 1
        : clamp((HEIGHT - 95) / (HEIGHT - Math.min(0, futureY - 90)), 0.36, 1);
    this.scale +=
      (target - this.scale) *
      (1 - Math.exp(-dt * (target < this.scale ? 9 : 3.2)));
    if (Math.abs(this.scale - 1) < 0.0001) this.scale = 1;
    const margin = (WIDTH * (1 - this.scale)) / 2;
    const follow = projectile
      ? clamp((WIDTH / 2 - projectile.x) * 0.07, -margin * 0.4, margin * 0.4)
      : 0;
    const nextX = margin + follow;
    this.x += (nextX - this.x) * (1 - Math.exp(-dt * 6));
    this.y = HEIGHT * (1 - this.scale);
  }
  toWorld(point: Vec): Vec {
    return {
      x: (point.x - this.x) / this.scale,
      y: (point.y - this.y) / this.scale,
    };
  }
  toScreen(point: Vec): Vec {
    return {
      x: point.x * this.scale + this.x,
      y: point.y * this.scale + this.y,
    };
  }
}
