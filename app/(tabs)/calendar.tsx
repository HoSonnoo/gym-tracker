import { Colors } from '@/constants/Colors';
import { StyleSheet, Text, View } from 'react-native';

export default function CalendarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Calendario</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Storico sessioni</Text>
        <Text style={styles.cardText}>
          Qui vedrai lo storico delle sessioni giorno per giorno.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Vista futura</Text>
        <Text style={styles.cardText}>
          Ogni data ti permetterà di controllare l’allenamento svolto e i dettagli registrati.
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