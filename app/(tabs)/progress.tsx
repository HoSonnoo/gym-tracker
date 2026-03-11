import { Colors } from '@/constants/Colors';
import { StyleSheet, Text, View } from 'react-native';

export default function ProgressScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Progressi</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Evoluzione nel tempo</Text>
        <Text style={styles.cardText}>
          Qui visualizzerai i tuoi miglioramenti nel tempo.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dati futuri</Text>
        <Text style={styles.cardText}>
          Potrai vedere record personali, andamento dei carichi e storico per esercizio.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 20,
    gap: 16,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.dark.text,
    marginTop: 8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.dark.textMuted,
  },
});