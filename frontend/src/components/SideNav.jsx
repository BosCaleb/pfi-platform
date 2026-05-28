/**
 * SideNav — Collapsible grouped sidebar navigation.
 *
 * Desktop: sticky left sidebar, 220px expanded / 60px icon-only.
 * Mobile:  horizontal scrollable icon strip across the top.
 *
 * Each group has a unique accent color that tints the active item.
 * CSS variable --g is set per active item so the stylesheet can use
 * color-mix(in srgb, var(--g) …) for tinted backgrounds/borders.
 */
import { useState } from "react";
import { NAV_GROUPS } from "../constants.js";

export function SideNav({ tab, setTab }) {
  const [collapsed, setCollapsed]   = useState(false);
  const [openGroups, setOpenGroups] = useState(
    () => new Set(NAV_GROUPS.map(g => g.id))
  );

  function toggleGroup(gid) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else                next.add(gid);
      return next;
    });
  }

  return (
    <aside className={`sidenav${collapsed ? " sidenav--collapsed" : ""}`}>
      {/* ── Collapse / expand toggle ─────────────── */}
      <button
        className="sidenav-toggle"
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
      >
        <span className="sn-toggle-arrow">{collapsed ? "›" : "‹"}</span>
        {!collapsed && <span className="sn-toggle-label">Collapse</span>}
      </button>

      {/* ── Scrollable groups ───────────────────── */}
      <div className="sidenav-body">
        {NAV_GROUPS.map(group => {
          const isOpen    = openGroups.has(group.id);
          const hasActive = group.items.some(i => i.id === tab);

          return (
            <div
              key={group.id}
              className={`sn-group${hasActive ? " sn-group--lit" : ""}`}
            >
              {/* Group header */}
              {collapsed ? (
                /* collapsed: just a thin colored rule between groups */
                <div
                  className="sn-group-rule"
                  style={{ background: group.color }}
                  title={group.label}
                />
              ) : (
                <button
                  type="button"
                  className="sn-group-header"
                  onClick={() => toggleGroup(group.id)}
                >
                  <span
                    className="sn-group-pip"
                    style={{ background: group.color }}
                  />
                  <span className="sn-group-name">{group.label}</span>
                  <span className="sn-group-chevron">
                    {isOpen ? "▾" : "▸"}
                  </span>
                </button>
              )}

              {/* Items — always visible when collapsed; toggled when expanded */}
              {(isOpen || collapsed) && (
                <div className="sn-group-items">
                  {group.items.map(({ id, icon, label }) => {
                    const active = tab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`sn-item${active ? " sn-item--active" : ""}`}
                        onClick={() => setTab(id)}
                        title={collapsed ? label : undefined}
                        /* CSS var lets stylesheet tint with the group colour */
                        style={active ? { "--g": group.color } : undefined}
                      >
                        <span className="sn-item-icon">{icon}</span>
                        {!collapsed && (
                          <>
                            <span className="sn-item-label">{label}</span>
                            {active && (
                              <span
                                className="sn-item-dot"
                                style={{ background: group.color }}
                              />
                            )}
                          </>
                        )}
                        {/* Left accent bar visible in both modes when active */}
                        {active && (
                          <span
                            className="sn-item-bar"
                            style={{ background: group.color }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
