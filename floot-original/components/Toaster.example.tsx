import { Example } from "@floot/examples";
import { Archive, Link2 } from "lucide-react";
import { ToasterView } from "./Toaster";
import { Button } from "./Button";
import { toast, type ToastItem } from "../helpers/toast";
import styles from "./Toaster.example.module.css";

let version = 0;
const notice = (item: Omit<ToastItem, "version" | "duration"> & { duration?: number }): ToastItem => ({
  duration: Infinity,
  version: ++version,
  ...item,
});

const noop = () => {};

const TONES: { title: string; item: ToastItem }[] = [
  { title: "Default", item: notice({ id: "t-default", tone: "default", title: "Marked as unread" }) },
  { title: "Success", item: notice({ id: "t-success", tone: "success", title: "Saved" }) },
  { title: "Error", item: notice({ id: "t-error", tone: "error", title: "Couldn't send message" }) },
  { title: "Warning", item: notice({ id: "t-warning", tone: "warning", title: "You're offline. Changes will sync later" }) },
  { title: "Info", item: notice({ id: "t-info", tone: "info", title: "A new version is available" }) },
  { title: "Loading", item: notice({ id: "t-loading", tone: "loading", title: "Uploading roadmap.pdf…" }) },
];

const withAction = notice({
  id: "t-undo",
  tone: "default",
  icon: <Archive size={11} />,
  title: "#design archived",
  action: { label: "Undo", onClick: noop },
});

const errorWithAction = notice({
  id: "t-retry",
  tone: "error",
  title: "Couldn't send message",
  action: { label: "Retry", onClick: noop },
});

const withDescription = notice({
  id: "t-desc",
  tone: "success",
  title: "Invite sent",
  description: "jane@example.com will get an email in a minute",
});

const customIcon = notice({ id: "t-icon", tone: "default", icon: <Link2 size={12} />, title: "Link copied" });

const longTitle = notice({
  id: "t-long",
  tone: "default",
  title: "This notice is far too long to fit on one line, so the end of it is cut off with an ellipsis rather than wrapping",
});

// Oldest first, as the toast store keeps them: the last one is in front.
const stack: ToastItem[] = [
  notice({ id: "s-1", tone: "success", title: "Link copied" }),
  notice({ id: "s-2", tone: "default", icon: <Archive size={11} />, title: "#design archived", action: { label: "Undo", onClick: noop } }),
  notice({ id: "s-3", tone: "error", title: "Couldn't send message", action: { label: "Retry", onClick: noop } }),
];

function TryIt() {
  return (
    <div className={styles.buttons}>
      <Button variant="outline" onClick={() => toast("Marked as unread")}>
        Default
      </Button>
      <Button variant="outline" onClick={() => toast.success("Saved")}>
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.error("Couldn't send message", {
            action: { label: "Retry", onClick: () => toast.success("Sent") },
          })
        }
      >
        Error with Retry
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast("Task deleted", {
            description: "Fix the login redirect",
            action: { label: "Undo", onClick: () => toast("Task restored") },
          })
        }
      >
        Undo
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
            loading: "Uploading roadmap.pdf…",
            success: "Uploaded",
            error: "Upload failed",
          })
        }
      >
        Loading, then done
      </Button>
      <Button variant="ghost" onClick={() => toast.dismiss()}>
        Dismiss all
      </Button>
    </div>
  );
}

export default function ToasterShowcase() {
  return (
    <>
      <h1>Toaster</h1>
      <p>
        The app's notification surface: a compact capsule at the top centre of the screen that confirms
        an action, reports a failure, or offers a single follow-up such as Undo or Retry. Show one by
        calling <code>toast</code> from <code>helpers/toast</code>, anywhere in the app. The Toaster that
        renders them is already mounted by the global providers.
      </p>
      <ul>
        <li>
          <code>toast("Marked as unread")</code>, <code>toast.success</code>, <code>.error</code>,{" "}
          <code>.warning</code>, <code>.info</code>, <code>.loading</code>
        </li>
        <li>
          Options: <code>description</code> (one short line), <code>action</code> (
          <code>{"{ label, onClick }"}</code>), <code>icon</code>, <code>duration</code>, <code>id</code>
        </li>
        <li>
          <code>toast.promise(work, {"{ loading, success, error }"})</code> shows a spinner until the
          promise settles; re-using an <code>id</code> replaces a notice in place.
        </li>
        <li>
          Notices last 3.5 seconds (6 with an action or an error); <code>loading</code> stays until
          replaced or dismissed. Nothing expires while the pointer is over them.
        </li>
      </ul>

      <h2>Try it</h2>
      <p>These raise real notices at the top of the preview.</p>
      <Example title="Live notices" description="Each button calls toast() as app code would.">
        <TryIt />
      </Example>

      <h2>Tones</h2>
      <div className={styles.grid}>
        {TONES.map(({ title, item }) => (
          <Example key={title} title={title} width={360}>
            <ToasterView items={[item]} inline />
          </Example>
        ))}
      </div>

      <h2>Content</h2>
      <div className={styles.grid}>
        <Example title="With an action" description="One action at most. Clicking it also dismisses the notice." width={360}>
          <ToasterView items={[withAction]} inline />
        </Example>
        <Example title="Error with Retry" width={360}>
          <ToasterView items={[errorWithAction]} inline />
        </Example>
        <Example title="With a description" width={360}>
          <ToasterView items={[withDescription]} inline />
        </Example>
        <Example title="Custom icon" width={360}>
          <ToasterView items={[customIcon]} inline />
        </Example>
        <Example title="Title too long" description="One line only: the rest is cut off." width={360}>
          <ToasterView items={[longTitle]} inline />
        </Example>
      </div>

      <h2>Several at once</h2>
      <p>
        Notices stack with the newest in front and up to two older ones peeking out underneath. Tapping
        or hovering the stack fans it out so each one can be read, actioned or swiped away.
      </p>
      <div className={styles.grid}>
        <Example title="Stack, folded" width={420}>
          <ToasterView items={stack} inline />
        </Example>
        <Example title="Stack, fanned out" width={420}>
          <ToasterView items={stack} inline defaultExpanded />
        </Example>
      </div>

      <h2>Joined to the Dynamic Island</h2>
      <p>
        In the native iPhone app, on a phone with a Dynamic Island, the notice grows out of the camera
        pill instead of floating below the status bar.
      </p>
      <Example title="Dynamic Island" width={420}>
        <div className={styles.phoneTop}>
          <span className={styles.pill} aria-hidden />
          <ToasterView items={[withAction]} inline dynamic islandTop={11} />
        </div>
      </Example>
    </>
  );
}
