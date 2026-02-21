export const generateStage = (level) => {
  const pegs = [];
  const movingWalls = [];
  const portals = [];
  const rotatingBars = [];
  const rows = 16;
  const cols = 10;

  for (let r = 5; r < rows - 2; r += 2) {
    for (let c = 1; c < cols; c++) {
      if (Math.random() > 0.4) {
        let type = "normal";
        let color = "#00f3ff";
        let radius = 12;
        const rand = Math.random();
        if (rand > 0.93) {
          type = "suction";
          color = "#ff00ff";
          radius = 18;
        } else if (rand > 0.8) {
          type = "gold";
          color = "#ffff00";
          radius = 16;
        }
        pegs.push({
          x: c * (400 / cols) + 20,
          y: r * 38,
          type,
          color,
          radius,
          active: true,
        });
      }
    }
  }

  if (pegs.filter((p) => p.type === "gold").length === 0) {
    const idx = Math.floor(Math.random() * pegs.length);
    pegs[idx].type = "gold";
    pegs[idx].color = "#ffff00";
  }

  if (level >= 10)
    movingWalls.push({
      x: 200,
      y: 350,
      w: 120,
      h: 20,
      dir: 1,
      speed: 2 + level * 0.05,
      range: 140,
    });

  if (level >= 20) {
    const entryX = 50 + Math.random() * 300;
    const entryY = 300 + Math.random() * 200;
    const exitX = 50 + Math.random() * 300;
    const exitY = 100 + Math.random() * 120;
    portals.push({
      entry: { x: entryX, y: entryY },
      exit: { x: exitX, y: exitY },
    });
  }

  if (level >= 30) {
    const coords = [
      { x: 200, y: 300 },
      { x: 100, y: 220 },
      { x: 300, y: 380 },
      { x: 300, y: 220 },
      { x: 100, y: 380 },
    ];
    let barCount =
      level >= 70 ? 5 : level >= 60 ? 4 : level >= 50 ? 3 : level >= 40 ? 2 : 1;
    for (let i = 0; i < barCount; i++) {
      rotatingBars.push({
        x: coords[i].x,
        y: coords[i].y,
        length: 80,
        width: 12,
        angle: Math.random() * Math.PI,
        speed: (i % 2 === 0 ? 0.03 : -0.03) + level * 0.0005,
      });
    }
  }

  return {
    level,
    pegs,
    movingWalls,
    portals,
    rotatingBars,
    ballCount: Math.max(5, 12 - Math.floor(level / 15)),
    gravityZones: [{ x: 100, y: 150, w: 200, h: 60, power: -0.15 }],
  };
};
