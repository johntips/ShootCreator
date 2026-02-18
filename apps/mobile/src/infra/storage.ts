import type { Session, SessionRepository } from "@shoot-creater/core";
import { useCallback, useEffect, useState } from "react";
import { getSessionRepository } from "./sessionRepository";

/**
 * Hook to interact with session storage.
 * Currently backed by SQLite, swappable to cloud by changing the repository.
 */
export function useSessionStore() {
	const repo: SessionRepository = getSessionRepository();

	const save = useCallback(
		async (session: Session) => {
			await repo.save(session);
		},
		[repo],
	);

	const loadAll = useCallback(async () => {
		return repo.getAll();
	}, [repo]);

	const loadToday = useCallback(async () => {
		const now = new Date();
		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
		return repo.getByDateRange(startOfDay, endOfDay);
	}, [repo]);

	const remove = useCallback(
		async (id: string) => {
			await repo.delete(id);
		},
		[repo],
	);

	return { save, loadAll, loadToday, remove };
}

/**
 * Hook to load session history with auto-refresh.
 */
export function useSessionHistory() {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [loading, setLoading] = useState(true);
	const repo: SessionRepository = getSessionRepository();

	const refresh = useCallback(async () => {
		setLoading(true);
		const all = await repo.getAll();
		setSessions(all);
		setLoading(false);
	}, [repo]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return { sessions, loading, refresh };
}
