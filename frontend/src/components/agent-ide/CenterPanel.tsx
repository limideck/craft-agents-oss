import { useState } from "react";
import { ChevronDown, Cloud, Mic, Plus, Filter, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export function CenterPanelHeader() {
  return (
    <div className="flex h-9 items-center justify-between border-b border-ide-border bg-ide-panel px-3">
      <div className="text-[13px] text-ide-text">Ide agent 个人管理</div>
      <button className="rounded p-1 text-ide-text-dim hover:bg-ide-hover hover:text-ide-text">
        <Cloud className="h-4 w-4" />
      </button>
    </div>
  );
}

export function CenterPanel() {
  const [walkthroughOpen, setWalkthroughOpen] = useState(true);
  const [input, setInput] = useState("");

  return (
    <div className="flex h-full flex-col bg-ide-panel text-ide-text">
      {/* Branch chip */}
      <div className="px-4 pt-4">
        <div className="rounded-md border border-ide-border bg-ide-input px-3 py-2 text-[13px] text-ide-text-muted">
          ave 2: 任务 02
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 text-[13px] leading-relaxed">
        <div className="text-ide-text-dim">Worked for 9m 2s</div>
        <p className="mt-3 text-ide-text">
          任务 02 完成并已推送。三种服务模式全部实测通过。
        </p>

        <h3 className="mt-5 mb-2 text-[13px] font-semibold text-ide-text">Walkthrough</h3>
        <div className="rounded-md border border-ide-border bg-ide-panel-2">
          <button
            onClick={() => setWalkthroughOpen(!walkthroughOpen)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-ide-text-dim transition-transform",
                !walkthroughOpen && "-rotate-90",
              )}
            />
            <span className="text-[13px] text-ide-text">Task 02 ide serving verification</span>
          </button>
          {walkthroughOpen && (
            <div className="px-3 pb-3">
              <div className="rounded border border-dashed border-ide-border bg-ide-input py-3 text-center text-[12px] text-ide-text-dim">
                Waiting for upload...
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-ide-text">
          三条验收逐一验证：
          <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">
            KANDEV_WEB_DIST_DIR
          </code>
          指向{" "}
          <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">
            apps/ide/dist
          </code>{" "}
          时后端在 <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">/</code>{" "}
          输出带{" "}
          <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">
            __KANDEV_BOOT_PAYLOAD__
          </code>{" "}
          的 ide SPA（资源 200）；
          <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">
            make dev-ide
          </code>{" "}
          启动 ide Vite（37430）并让后端代理{" "}
          <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">/</code> 到
          Vite dev shell（响应含{" "}
          <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">
            @react-refresh
          </code>{" "}
          /{" "}
          <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">@vite/client</code>
          ）；环境变量不设置时回退到内嵌 web 资源，行为与之前完全一致。
        </p>

        <h3 className="mt-5 mb-2 text-[13px] font-semibold text-ide-text">Summary</h3>
        <ul className="space-y-2 pl-4">
          <li className="list-disc marker:text-ide-text-dim">
            <code className="rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">Makefile</code>{" "}
            新增三个目标：
            <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">
              build-ide
            </code>
            （生产构建 <code className="rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">apps/ide/dist</code>）、
            <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">dev-ide</code>
            （后台起 ide Vite + 前端后端联动）、
            <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">serve-ide</code>
            （用 <code className="rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">KANDEV_WEB_DIST_DIR</code> 服务已构建产物）；帮助文本同步更新。
          </li>
          <li className="list-disc marker:text-ide-text-dim">
            无需改任何 Go 代码——
            <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">
              webAssetsFS()
            </code>{" "}
            和 dev 代理的现有覆盖点已满足两种模式，
            <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">web</code>{" "}
            默认行为零改动。
          </li>
          <li className="list-disc marker:text-ide-text-dim">
            <code className="rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">
              docs/remote-cloud-environment.md
            </code>{" "}
            补充了{" "}
            <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">dev-ide</code>{" "}
            /{" "}
            <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">build-ide</code>{" "}
            /{" "}
            <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">serve-ide</code>{" "}
            命令说明；任务 02 状态更新为 done（含实现说明）。
          </li>
        </ul>

        <h3 className="mt-5 mb-2 text-[13px] font-semibold text-ide-text">Testing</h3>
        <ul className="space-y-1 pl-4">
          <li className="list-disc marker:text-ide-text-dim">
            <span className="text-ide-add">✅</span>{" "}
            <code className="mx-1 rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">
              make build-ide
            </code>{" "}
            (6.5s 构建出{" "}
            <code className="rounded bg-ide-input px-1 py-0.5 text-[12px] text-ide-code">apps/ide/dist</code>
            )
          </li>
        </ul>
      </div>

      {/* Composer */}
      <div className="border-t border-ide-border p-2">
        <div className="flex items-center gap-2 rounded-md border border-ide-border bg-ide-input px-2 py-1.5">
          <button className="rounded p-1 text-ide-text-dim hover:bg-ide-hover hover:text-ide-text">
            <Plus className="h-4 w-4" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a follow up"
            className="flex-1 bg-transparent text-[13px] text-ide-text placeholder:text-ide-text-dim focus:outline-none"
          />
          <button className="flex items-center gap-1 rounded px-2 py-0.5 text-[12px] text-ide-text-muted hover:bg-ide-hover">
            Fable 5 High
            <ChevronDown className="h-3 w-3" />
          </button>
          <button className="rounded p-1 text-ide-text-dim hover:bg-ide-hover hover:text-ide-text">
            <Mic className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export { Filter, MoreHorizontal };
