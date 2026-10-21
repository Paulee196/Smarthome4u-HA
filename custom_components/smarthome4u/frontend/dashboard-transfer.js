/* Přesun dlaždice mezi kartami je jedna změna uložené plochy.
 * Místnosti a zařízení zůstávají v Home Assistantu beze změny. */

export function visibleRoomRefs(room, layout, entityRef) {
  const refs = (room.entities || []).map(entityRef).filter(Boolean);
  const ordered = [...new Set((layout.entities || []).filter((ref) => typeof ref === "string"))];
  const excluded = new Set(layout.excluded || []);
  return [...ordered, ...refs.filter((ref) => !ordered.includes(ref) && !excluded.has(ref))];
}

function section(blocks, rooms, id, entityRef) {
  const own = blocks.find((block) => block.id === id
    && (block.type === "entities" || block.type === "room"));
  if (own) return {
    list: own.entities || [], styles: own.tileStyles || {}, sizes: own.sizes || {},
    setList: (list) => { own.entities = list; },
    setStyle: (key, value) => { own[key] = value; },
  };

  if (!id.startsWith("auto-")) return null;
  const roomId = id.slice(5);
  const room = rooms.find((item) => String(item.id || "unassigned") === roomId);
  const auto = blocks.find((block) => block.type === "auto_rooms");
  if (!room || !auto) return null;
  auto.roomLayouts ||= {};
  const saved = auto.roomLayouts[roomId] ||= {};
  const refs = (room.entities || []).map(entityRef).filter(Boolean);
  return {
    list: visibleRoomRefs(room, saved, entityRef),
    styles: saved.tileStyles || {}, sizes: saved.sizes || {},
    setList: (list) => {
      saved.entities = list;
      saved.excluded = refs.filter((ref) => !list.includes(ref));
    },
    setStyle: (key, value) => { saved[key] = value; },
  };
}

export function moveDashboardEntity(blocks, rooms, sourceId, targetId, ref, index, entityRef) {
  if (sourceId === targetId || !ref) return null;
  const next = structuredClone(blocks);
  const source = section(next, rooms, sourceId, entityRef);
  const target = section(next, rooms, targetId, entityRef);
  if (!source?.list.includes(ref) || !target) return null;

  source.setList(source.list.filter((item) => item !== ref));
  const targetList = target.list.filter((item) => item !== ref);
  targetList.splice(Math.max(0, Math.min(targetList.length, index)), 0, ref);
  target.setList(targetList);

  for (const key of ["sizes", "tileStyles"]) {
    const oldValue = key === "sizes" ? source.sizes : source.styles;
    const newValue = key === "sizes" ? target.sizes : target.styles;
    if (!Object.hasOwn(oldValue, ref)) continue;
    target.setStyle(key, { ...newValue, [ref]: oldValue[ref] });
    const cleaned = { ...oldValue };
    delete cleaned[ref];
    source.setStyle(key, cleaned);
  }
  return next;
}
