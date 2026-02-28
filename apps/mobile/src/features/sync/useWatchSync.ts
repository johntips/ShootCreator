/**
 * Watch 双方向同期 React Hook
 *
 * セッション画面で使用。セッションライフサイクルに合わせて
 * SyncService の start/stop を管理する。
 */
import type { Session, Shot } from "@shoot-creater/core";
import { useCallback, useEffect, useRef } from "react";
import { type SyncService, getSyncService } from "./SyncService";

interface UseWatchSyncOptions {
  session: Session;
  onRemoteShot: (shot: Shot) => void;
  onRemoteZoneChange: (zoneId: string) => void;
}

export function useWatchSync({ session, onRemoteShot, onRemoteZoneChange }: UseWatchSyncOptions) {
  const serviceRef = useRef<SyncService>(getSyncService());
  const callbacksRef = useRef({ onRemoteShot, onRemoteZoneChange });
  callbacksRef.current = { onRemoteShot, onRemoteZoneChange };

  // セッション開始時にリスナー登録、終了時にクリーンアップ
  // biome-ignore lint/correctness/useExhaustiveDependencies: session.id でのみ再登録（意図的）
  useEffect(() => {
    const svc = serviceRef.current;
    void svc.start({
      onShot: (shot) => callbacksRef.current.onRemoteShot(shot),
      onZoneChange: (zoneId) => callbacksRef.current.onRemoteZoneChange(zoneId),
    });

    // Watch にセッション開始を通知（fire-and-forget）
    void svc.sendSessionStart(session);

    return () => svc.stop();
    // session.id が変わった時のみ再登録
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // セッション参照を常に最新に保つ（watch-ready 返信用）
  useEffect(() => {
    serviceRef.current.updateSession(session);
  }, [session]);

  // sendShot: 更新後セッションを受け取り、即座にスタッツ同期
  const sendShot = useCallback((zoneId: string, made: boolean, updatedSession: Session) => {
    void serviceRef.current.sendShot(zoneId, made, updatedSession);
  }, []);

  const sendZoneChange = useCallback((zoneId: string) => {
    void serviceRef.current.sendZoneChange(zoneId);
  }, []);

  const sendSessionEnd = useCallback((endedSession: Session) => {
    void serviceRef.current.sendSessionEnd(endedSession);
  }, []);

  const syncStats = useCallback((updatedSession: Session) => {
    void serviceRef.current.syncStats(updatedSession);
  }, []);

  return { sendShot, sendZoneChange, sendSessionEnd, syncStats };
}
