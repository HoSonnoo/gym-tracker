import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const PRIMARY = '#7e47ff';
export const NUTRITION_GUIDE_KEY = '@vyro:nutrition_guide_seen';

type GuidePhase = 'empty' | 'has_catalog' | 'ready';

export default function NutritionGuide({
  phase,
  onDone,
}: {
  phase: GuidePhase;
  onDone: () => void;
}) {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Alimentazione</Text>

      {/* Welcome card */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeEmoji}>🥗</Text>
        <Text style={styles.welcomeTitle}>Benvenuto in Alimentazione</Text>
        <Text style={styles.welcomeText}>
          Traccia i tuoi pasti, gestisci piani alimentari e monitora il corpo.
          Inizia aggiungendo i tuoi primi alimenti.
        </Text>
      </View>

      {/* Step 1 — Catalogo */}
      <View style={[
        styles.stepCard,
        phase !== 'empty' && styles.stepCardCompleted,
      ]}>
        <View style={styles.stepHeader}>
          <View style={[
            styles.stepBadge,
            phase !== 'empty' && styles.stepBadgeDone,
          ]}>
            <Text style={styles.stepBadgeText}>
              {phase !== 'empty' ? '✓' : '1'}
            </Text>
          </View>
          <Text style={[
            styles.stepTitle,
            phase !== 'empty' && styles.stepTitleDone,
          ]}>
            Aggiungi alimenti al catalogo
          </Text>
        </View>
        {phase === 'empty' && (
          <>
            <Text style={styles.stepText}>
              Il catalogo è il tuo archivio personale di alimenti con i relativi macro.
              Puoi aggiungerne manualmente o cercarli online tramite Open Food Facts.
            </Text>
            <Pressable
              style={styles.stepButton}
              onPress={onDone}
            >
              <Text style={styles.stepButtonText}>Vai al catalogo →</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Step 2 — Diario */}
      <View style={[
        styles.stepCard,
        phase === 'empty' && styles.stepCardMuted,
      ]}>
        <View style={styles.stepHeader}>
          <View style={[
            styles.stepBadge,
            phase === 'empty' && styles.stepBadgeMuted,
          ]}>
            <Text style={[
              styles.stepBadgeText,
              phase === 'empty' && styles.stepBadgeTextMuted,
            ]}>2</Text>
          </View>
          <Text style={[
            styles.stepTitle,
            phase === 'empty' && { color: Colors.dark.textMuted },
          ]}>
            Registra i tuoi pasti
          </Text>
        </View>
        {phase === 'has_catalog' && (
          <>
            <Text style={styles.stepText}>
              Nel tab Diario puoi aggiungere gli alimenti ai tuoi pasti giornalieri
              e vedere il riepilogo di calorie e macro.
            </Text>
            <Pressable style={styles.stepButton} onPress={onDone}>
              <Text style={styles.stepButtonText}>Vai al diario →</Text>
            </Pressable>
          </>
        )}
        {phase === 'empty' && (
          <Text style={styles.stepTextMuted}>
            Disponibile dopo aver aggiunto almeno un alimento al catalogo.
          </Text>
        )}
      </View>

      {/* Step 3 — Piano */}
      <View style={[styles.stepCard, styles.stepCardMuted]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepBadge, styles.stepBadgeMuted]}>
            <Text style={[styles.stepBadgeText, styles.stepBadgeTextMuted]}>3</Text>
          </View>
          <Text style={[styles.stepTitle, { color: Colors.dark.textMuted }]}>
            Importa un piano alimentare
          </Text>
        </View>
        <Text style={styles.stepTextMuted}>
          Carica il PDF del tuo nutrizionista e Claude lo strutturerà automaticamente.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text },
  welcomeCard: {
    backgroundColor: 'rgba(126,71,255,0.1)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.3)',
    alignItems: 'center',
    gap: 8,
  },
  welcomeEmoji: { fontSize: 40 },
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: Colors.dark.text, textAlign: 'center' },
  welcomeText: { fontSize: 14, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 20 },
  stepCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  stepCardCompleted: {
    borderColor: Colors.dark.success,
    backgroundColor: 'rgba(34,197,94,0.04)',
  },
  stepCardMuted: { opacity: 0.6 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: { backgroundColor: Colors.dark.success },
  stepBadgeMuted: { backgroundColor: Colors.dark.border },
  stepBadgeText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  stepBadgeTextMuted: { color: Colors.dark.textMuted },
  stepTitle: { fontSize: 16, fontWeight: '700', color: Colors.dark.text, flex: 1 },
  stepTitleDone: { color: Colors.dark.success },
  stepText: { fontSize: 14, color: Colors.dark.textMuted, lineHeight: 20 },
  stepTextMuted: { fontSize: 13, color: Colors.dark.textMuted, fontStyle: 'italic' },
  stepButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  stepButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});