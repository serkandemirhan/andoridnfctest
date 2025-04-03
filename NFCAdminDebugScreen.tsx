// NFCAdminDebugScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Button,
  TextInput,
  Alert,
} from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { Buffer } from 'buffer';
import * as Crypto from 'crypto-js';

// Secret key used for HMAC generation
const SECRET_KEY = 'super_secure_key';

export default function NFCAdminDebugScreen() {
  const [uid, setUid] = useState('');
  const [counter, setCounter] = useState(0);
  const [hmac, setHmac] = useState('');
  const [status, setStatus] = useState('Idle');

  const generateHmac = (uid: string, counter: number): string => {
    const message = `${uid}|${counter}`;
    const hash = Crypto.HmacSHA256(message, SECRET_KEY);
    return Crypto.enc.Hex.stringify(hash).substring(0, 8); // 4 bytes = 8 hex chars
  };

  const readCard = async () => {
    setStatus('Reading...');
    try {
      await NfcManager.start();
      await NfcManager.requestTechnology(NfcTech.Ndef);

      const tag = await NfcManager.getTag();
      const tagId = tag?.id;
      if (!tagId) throw new Error('UID not found');
      setUid(tagId);

      const payload = tag?.ndefMessage?.[0]?.payload;
      if (!payload) throw new Error('No NDEF payload found');

      const text = Ndef.text.decodePayload(payload);
      const [readCounterStr, readHmac] = text.split('|');
      const readCounter = parseInt(readCounterStr);
      setCounter(readCounter);
      setHmac(readHmac);

      const expectedHmac = generateHmac(tagId, readCounter);

      if (expectedHmac === readHmac) {
        Alert.alert('✅ Verified', 'Card is authentic and counter is valid.');
      } else {
        Alert.alert('❌ Verification Failed', 'HMAC mismatch. Possible cloned card.');
      }

      setStatus('Read complete.');
    } catch (err: any) {
      console.warn(err);
      Alert.alert('Error', err.message);
      setStatus('Failed to read card.');
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  };

  const writeCard = async () => {
    setStatus('Writing...');
    try {
      await NfcManager.start();
      await NfcManager.requestTechnology(NfcTech.Ndef);

      const tag = await NfcManager.getTag();
      const tagId = tag?.id;
      if (!tagId) throw new Error('UID not found');
      setUid(tagId);

      const newCounter = counter + 1;
      const newHmac = generateHmac(tagId, newCounter);

      const text = `${newCounter}|${newHmac}`;
      const bytes = Ndef.encodeMessage([Ndef.textRecord(text)]);

      await NfcManager.writeNdefMessage(bytes);

      setCounter(newCounter);
      setHmac(newHmac);

      Alert.alert('✅ Write Success', `Counter updated to ${newCounter}`);
      setStatus('Write complete.');
    } catch (err: any) {
      console.warn(err);
      Alert.alert('Error', err.message);
      setStatus('Failed to write card.');
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>
        🛠️ NFC Admin Debug Panel
      </Text>

      <Text>Status: {status}</Text>
      <Text>UID: {uid}</Text>
      <Text>Counter: {counter}</Text>
      <Text>HMAC: {hmac}</Text>

      <View style={{ marginVertical: 20 }}>
        <Button title="📥 Read from NFC Card" onPress={readCard} />
      </View>

      <View style={{ marginBottom: 20 }}>
        <Button title="📤 Write to NFC Card (Increment Counter)" onPress={writeCard} />
      </View>
    </ScrollView>
  );
}