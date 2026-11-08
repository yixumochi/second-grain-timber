// These views show saved source images, model renders and observation records.
const sourcePhoto = 'assets/115200-1-photo.webp';
const savedCloud = 'assets/ai-process/115200-saved-cloud-render.png';
const backedFrame = '../assets/update/p09-structure-and-backing.webp';
const records = {
  materials: {
    source: {
      image: sourcePhoto, silhouette: true, alt: 'Seller view 01 of beam 115200, isolated with its saved mask',
      caption: 'Seller view 01 · isolated with its saved mask', evidence: sourcePhoto,
      kicker: '01 / SELLER RECORD', title: 'One beam, three views',
      copy: 'The listing reports a length of 1,104.9 mm. Grade, decay and unseen faces still need evidence.',
      href: '#material-tools', label: 'See the seller record',
    },
    mask: {
      image: 'assets/115200-1-overlay.webp', alt: 'Saved SAM 2 overlay on seller view 01 of beam 115200',
      caption: 'View 01 · saved mask overlay', evidence: 'assets/115200-2-overlay.webp',
      kicker: '02 / SAM 2', title: 'Separate wood from background',
      copy: 'Each view has its own mask. The masks help select which reconstructed points belong to the visible beam.',
      href: '#material-mask-evidence', label: 'Compare the three masks',
    },
    cloud: {
      image: savedCloud, cloud: true, alt: 'Saved point-cloud preview of beam 115200',
      caption: 'VGGT · uncalibrated scene units', evidence: 'assets/115200-3-overlay.webp',
      kicker: '03 / VGGT', title: 'Read the observed geometry',
      copy: 'Drag the saved point cloud to inspect it. The three colors identify source views. Their alignment is still unverified.',
      href: '#material-cloud-evidence', label: 'Open the full point-cloud viewer',
    },
    trim: {
      image: 'assets/ai-process/115200-automatic-detail.jpg', alt: 'Enlarged photo of crack-like candidate C01 on beam 115200',
      caption: 'C01 · candidate marked in seller view 01', evidence: savedCloud,
      kicker: '04 / DEFECT & TRIM', title: 'A shorter usable interval',
      copy: 'The proposed cut leaves 828.24 mm. A 900 mm member no longer fits; a 600 mm member still fits. Crack depth remains unknown.',
      href: '#ai-defect', label: 'Compare the trim scenarios',
    },
  },
  algorithm: {
    shelter: {
      image: '../assets/update/assembled.webp', alt: 'Saved timber shelter assembly with reclaimed wood cladding',
      caption: 'Saved Timber Shelter revision · assembled', evidence: backedFrame,
      kicker: '01 / SAVED REVISION', title: 'A revised shelter',
      copy: 'The saved revision adjusts 10 rails and studs. The enclosure and successful stock allocation are retained.',
      href: '#case1', label: 'Explore the Shelter case',
    },
    frame: {
      image: backedFrame, alt: 'The same shelter with its cladding removed to show the frame and backing',
      caption: 'Timber Shelter · structure and backing', evidence: '../assets/update/north-brace-backing-detail.webp',
      kicker: '02 / STRUCTURAL FRAME', title: 'See what supports the cladding',
      copy: 'The exposed model makes the rails, studs and braces visible. The saved revision also adjusts roof clearance by 12.7 mm.',
      href: '#ai-structural-change', label: 'Read the backing revision',
    },
    allocation: {
      image: 'assets/ai-process/backing-exploded-model-render.png', alt: 'Saved exploded view of the same timber shelter and its installed parts',
      caption: 'Timber Shelter · saved exploded view', evidence: '../assets/update/allocation-map.svg',
      kicker: '03 / STOCK ALLOCATION', title: 'Trace a cut into the shelter',
      copy: 'The saved allocation uses 87 source bars for 155 installed parts. Board 117803 supplies both a deck piece and west pier cladding.',
      href: '#assembly', label: 'Inspect the installed parts',
    },
    loads: {
      image: backedFrame, alt: 'The timber shelter structure used to contextualize the conceptual load comparison',
      caption: 'Timber Shelter · saved backing geometry', evidence: 'assets/narrative/case1-SENSITIVITY_D_WY_POS.svg',
      kicker: '04 / KARAMBA LOAD CASES', title: 'Wind improves; gravity changes',
      copy: 'Positive Y wind displacement drops from 56.2 to 11.8 mm. Dead-load displacement increases from 3.1 to 13.7 mm in the saved concept study.',
      href: '#ai-structural-change', label: 'Compare recorded load cases',
    },
  },
};

function mountPointCloud(canvas) {
  const context = canvas.getContext('2d');
  const palette = ['#456faf', '#b56823', '#667e46'];
  const pose = { yaw: -.42, pitch: .49 };
  let points, corners, edges, loading, drag, frame;
  function draw() {
    frame = null;
    if (canvas.hidden || !points || !context) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cy = Math.cos(pose.yaw), sy = Math.sin(pose.yaw);
    const cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
    function project([x, y, z]) {
      const u = x * cy + z * sy;
      const depth = -x * sy + z * cy;
      const v = -(y * cp - depth * sp);
      return [u * .97 - v * .24, u * .24 + v * .97, y * sp + depth * cp];
    }
    const box = corners.map(project);
    const plotted = points.map(({ point, color }) => ({ point: project(point), color }));
    const bounds = [...box, ...plotted.map(item => item.point)];
    const low = [Infinity, Infinity], high = [-Infinity, -Infinity];
    for (const point of bounds) for (let axis = 0; axis < 2; axis++) {
      low[axis] = Math.min(low[axis], point[axis]);
      high[axis] = Math.max(high[axis], point[axis]);
    }
    const unit = Math.min(w * .84 / (high[0] - low[0]), h * .74 / (high[1] - low[1]));
    const center = [(low[0] + high[0]) / 2, (low[1] + high[1]) / 2];
    const screen = ([x, y]) => [w / 2 + (x - center[0]) * unit, h / 2 + (y - center[1]) * unit];
    context.strokeStyle = '#768795';
    context.setLineDash([4, 4]);
    context.beginPath();
    for (const [a, b] of edges) {
      context.moveTo(...screen(box[a]));
      context.lineTo(...screen(box[b]));
    }
    context.stroke();
    context.setLineDash([]);
    plotted.sort((a, b) => b.point[2] - a.point[2]);
    for (const { point, color } of plotted) {
      const [x, y] = screen(point);
      context.fillStyle = color;
      context.fillRect(x, y, 1.6, 1.6);
    }
  }
  function redraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }
  async function show() {
    if (!context) throw new Error('Canvas not available');
    loading ??= (async () => {
      const response = await fetch('../assets/observation/records/115200.json.gz');
      if (!response.ok || !response.body) throw new Error('Saved points not available');
      const bytes = await response.arrayBuffer();
      const magic = new Uint8Array(bytes);
      const data = new Response(bytes);
      const decoded = magic[0] === 0x1f && magic[1] === 0x8b
        ? new Response(data.body.pipeThrough(new DecompressionStream('gzip')))
        : data;
      const { cloud } = await decoded.json();
      const box = cloud.proxy;
      const local = point => box.axes_rows.map(axis => axis.reduce(
        (sum, value, i) => sum + value * (point[i] - box.center_world[i]), 0,
      ));
      points = cloud.points.map((point, i) => ({
        point: local(point), color: palette[cloud.views[i]] ?? '#52635a',
      }));
      corners = box.corners_world.map(local);
      edges = box.edges;
    })().catch(error => { loading = null; throw error; });
    await loading;
    redraw();
  }
  canvas.addEventListener('pointerdown', event => {
    drag = [event.clientX, event.clientY];
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag) return;
    pose.yaw += (event.clientX - drag[0]) * .008;
    pose.pitch = Math.max(-1.3, Math.min(1.3, pose.pitch + (event.clientY - drag[1]) * .008));
    drag = [event.clientX, event.clientY];
    redraw();
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  canvas.addEventListener('keydown', event => {
    const delta = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] }[event.key];
    if (!delta) return;
    event.preventDefault();
    pose.yaw += delta[0];
    pose.pitch = Math.max(-1.3, Math.min(1.3, pose.pitch + delta[1]));
    redraw();
  });
  new ResizeObserver(redraw).observe(canvas);
  return { show, redraw };
}

for (const stage of document.querySelectorAll('[data-object-view]')) {
  const get = selector => stage.querySelector(selector);
  const canvas = get('[data-object-cloud]');
  const cloud = canvas ? mountPointCloud(canvas) : null;
  const image = get('[data-object-image]');
  const buttons = [...stage.querySelectorAll('[data-object-step]')];
  let request = 0;
  for (const button of buttons) button.addEventListener('click', async () => {
    const token = ++request;
    const view = records[stage.dataset.object][button.dataset.objectStep];
    buttons.forEach(control => control.setAttribute('aria-pressed', String(control === button)));
    image.src = view.image;
    image.alt = view.alt;
    image.hidden = false;
    image.classList.toggle('object-silhouette', Boolean(view.silhouette));
    get('[data-object-caption]').textContent = view.caption;
    get('[data-object-evidence-image]').src = view.evidence;
    get('[data-object-kicker]').textContent = view.kicker;
    get('[data-object-heading]').textContent = view.title;
    get('[data-object-copy]').textContent = view.copy;
    const link = get('[data-object-link]');
    link.href = view.href;
    link.firstChild.textContent = view.label + ' ';
    if (!cloud) return;
    canvas.hidden = true;
    const instruction = get('[data-cloud-instruction]');
    instruction.hidden = true;
    if (!view.cloud) return;
    try {
      await cloud.show();
      if (token !== request) return;
      canvas.hidden = false;
      image.hidden = true;
      instruction.hidden = false;
      cloud.redraw();
    } catch {
      if (token === request) get('[data-object-caption]').textContent = 'Saved preview · open the full viewer for the point cloud';
    }
  });
}
