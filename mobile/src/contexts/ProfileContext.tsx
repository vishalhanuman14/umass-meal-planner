import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";
import type { Profile, ProfileDraft } from "../types";

type ProfileContextValue = {
  profile: Profile | null;
  draft: ProfileDraft;
  loading: boolean;
  setDraft: (patch: ProfileDraft) => void;
  refreshProfile: () => Promise<void>;
  saveProfile: (patch?: ProfileDraft) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

const defaultDraft: ProfileDraft = {
  dietary_restrictions: [],
  allergens: [],
  preferred_dining_commons: []
};

export function ProfileProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraftState] = useState<ProfileDraft>(defaultDraft);
  const [loading, setLoading] = useState(false);

  const setDraft = useCallback((patch: ProfileDraft) => {
    setDraftState((current) => ({ ...current, ...patch }));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      setDraftState(defaultDraft);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();

    if (error) {
      setLoading(false);
      throw error;
    }

    if (!data) {
      const inserted = {
        id: session.user.id,
        email: session.user.email ?? "",
        name: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? "",
        onboarding_completed: false
      };
      const { data: created, error: createError } = await supabase
        .from("profiles")
        .insert(inserted)
        .select("*")
        .single();

      if (createError) {
        setLoading(false);
        throw createError;
      }

      setProfile(created as Profile);
      setDraftState({ ...defaultDraft, ...(created as Profile) });
      setLoading(false);
      return;
    }

    setProfile(data as Profile);
    setDraftState({ ...defaultDraft, ...(data as Profile) });
    setLoading(false);
  }, [session]);

  const saveProfile = useCallback(
    async (patch?: ProfileDraft) => {
      if (!session?.user) {
        throw new Error("Not signed in.");
      }

      const nextDraft = { ...draft, ...patch };
      const payload = {
        ...nextDraft,
        id: session.user.id,
        email: session.user.email ?? "",
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from("profiles").upsert(payload).select("*").single();

      if (error) {
        throw error;
      }

      setProfile(data as Profile);
      setDraftState({ ...defaultDraft, ...(data as Profile) });
    },
    [draft, session]
  );

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(
    () => ({ profile, draft, loading, setDraft, refreshProfile, saveProfile }),
    [draft, loading, profile, refreshProfile, saveProfile, setDraft]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) {
    throw new Error("useProfile must be used inside ProfileProvider");
  }
  return value;
}
