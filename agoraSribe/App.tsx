/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useRef, useState, useEffect} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {PermissionsAndroid, Platform} from 'react-native';
import RNFS from 'react-native-fs';
import RNFetchBlob from 'rn-fetch-blob';
import {
  ClientRoleType,
  RawAudioFrameOpModeType,
  AudioFrame,
  VideoFrame,
  createAgoraRtcEngine,
  IRtcEngine,
  RtcSurfaceView,
  ChannelProfileType,
  AudioFileRecordingType,
} from 'react-native-agora';
import axios from 'axios';
import FormData from 'form-data';
import TranscribedOutput from './src/components/TranscribeOutput';

const uid = 0;
const appId = 'ba0a1fde83e44e648d5423d43c03871b';
const channelName = 'agoraReactNativeStream';
const token =
  '007eJxTYJjBG6HCE1U4P2fn7RcVuTI9J7py+v7taV73YWHt6iiuys8KDEmJBomGaSmpFsapJiapZiYWKaYmRsYpJsbJBsYW5oZJza7mKQ2BjAw31x1jZmSAQBBfjCExPb8oMSg1MbnEL7Eksyw1uKQoNTGXgQEAPrsoAg==';
const SAMPLE_RATE = 16000;
const SAMPLE_NUM_OF_CHANNEL = 1;
const SAMPLES_PER_CALL = 1024;

const App = () => {
  const agoraEngineRef = useRef<IRtcEngine>(); // Agora engine instance
  const intervalRef: any = React.useRef(null);
  const [isJoined, setIsJoined] = useState(false); // Indicates if the local user has joined the channel
  const [isHost, setIsHost] = useState(true); // Client role
  const [remoteUid, setRemoteUid] = useState(0); // Uid of the remote user
  const [message, setMessage] = useState(''); // Message to the user
  const [transcribedData, setTranscribedData] = React.useState([] as any);
  const [isJoinLoading, setJoinLoading] = React.useState(false);
  const [isLeaveLoading, setLeaveLoading] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [transcribeTimeout, setTranscribeTimout] = React.useState(5);
  const [interimTranscribedData] = React.useState('');

  function transcribeInterim() {
    clearInterval(intervalRef.current);
  }

  const getPermission = async () => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ]);
    }
  };

  const iAudioFrameObserver = {
    onPlaybackAudioFrame(channelId: string, audioFrame: AudioFrame): true {
      return true;
    },
    oPlaybackAudioFrameBeforeMixing(
      channelId: string,
      uID: number,
      audioFrame: AudioFrame,
    ): true {
      return true;
    },
    onRecordAudioFrame(channelId: string, audioFrame: AudioFrame): true {
      return true;
    },
  };

  useEffect(() => {
    // Initialize Agora engine when the app starts
    setupVideoSDKEngine();
  }, []);

  const setupVideoSDKEngine = async () => {
    try {
      // use the helper function to get permissions
      if (Platform.OS === 'android') {
        await getPermission();
      }
      agoraEngineRef.current = createAgoraRtcEngine();
      const agoraEngine = agoraEngineRef.current;
      agoraEngine.registerEventHandler({
        onJoinChannelSuccess: () => {
          console.log('Successfully joined the channel ' + channelName);
          setIsJoined(true);
        },
        onUserJoined: (_connection, Uid) => {
          console.log('Remote user joined with uid ' + Uid);
          setRemoteUid(Uid);
        },
        onUserOffline: (_connection, Uid) => {
          console.log('Remote user left the channel. uid: ' + Uid);
          setRemoteUid(0);
        },
      });
      agoraEngine.initialize({
        appId: appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      console.log('Agora engine initialized successfully');
      agoraEngine.setPlaybackAudioFrameParameters(
        SAMPLE_RATE,
        SAMPLE_NUM_OF_CHANNEL,
        RawAudioFrameOpModeType.RawAudioFrameOpModeReadWrite,
        SAMPLES_PER_CALL,
      );
      agoraEngine.setRecordingAudioFrameParameters(
        SAMPLE_RATE,
        SAMPLE_NUM_OF_CHANNEL,
        RawAudioFrameOpModeType.RawAudioFrameOpModeReadWrite,
        SAMPLES_PER_CALL,
      );
      agoraEngine
        .getMediaEngine()
        .registerAudioFrameObserver(iAudioFrameObserver);
      console.log('Audio frame observer registered successfully');
      agoraEngine.setMixedAudioFrameParameters(
        SAMPLE_RATE,
        SAMPLE_NUM_OF_CHANNEL,
        SAMPLES_PER_CALL,
      );
      agoraEngine.muteAllRemoteAudioStreams(true);

      agoraEngine.enableVideo();
    } catch (e) {
      console.log(e);
    }
  };

  const join = async () => {
    setJoinLoading(true);
    resetTranscribedData();
    const recordingPath = `${RNFS.DocumentDirectoryPath}/audioRecordings`;
    RNFS.mkdir(recordingPath);
    const fileName = 'recording.wav';
    const filePath = `${recordingPath}/${fileName}`;

    console.log('joining channel');
    if (isJoined) {
      setJoinLoading(false);
      return;
    }
    try {
      agoraEngineRef.current?.setChannelProfile(
        ChannelProfileType.ChannelProfileLiveBroadcasting,
      );
      if (isHost) {
        agoraEngineRef.current?.startPreview();
        agoraEngineRef.current?.joinChannel(token, channelName, uid, {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        });
        console.log('recording started as a broadcaster');
        agoraEngineRef.current?.startAudioRecording({
          filePath: filePath,
          encode: false,
          sampleRate: SAMPLE_RATE,
          fileRecordingType: AudioFileRecordingType.AudioFileRecordingMixed,
        });
      } else {
        agoraEngineRef.current?.joinChannel(token, channelName, uid, {
          clientRoleType: ClientRoleType.ClientRoleAudience,
        });
        console.log('recording started as audience');
        agoraEngineRef.current?.startAudioRecording({
          filePath: filePath,
          encode: false,
          sampleRate: SAMPLE_RATE,
          fileRecordingType: AudioFileRecordingType.AudioFileRecordingMixed,
        });
      }
      setJoinLoading(false);
    } catch (e) {
      console.log(e);
    }
  };

  const leave = async () => {
    setLeaveLoading(true);
    try {
      agoraEngineRef.current?.leaveChannel();
      agoraEngineRef.current
        ?.getMediaEngine()
        .unregisterAudioFrameObserver(iAudioFrameObserver);
      console.log('stop recording ');
      agoraEngineRef.current?.stopAudioRecording();
      setRemoteUid(0);
      setIsJoined(false);
      console.log('you left the channel');
      startTranscribe();
    } catch (e) {
      console.log(e);
    }
    setLeaveLoading(false);
  };
  const startTranscribe = async () => {
    setIsTranscribing(true);
    const recordingPath = `${RNFS.DocumentDirectoryPath}/audioRecordings`;
    const fileName = 'recording.wav';
    const filePath = `${recordingPath}/${fileName}`;

    // Read the contents of the recorded file
    if (!(await RNFS.exists(recordingPath))) {
      await RNFS.mkdir(recordingPath);
    }

    RNFetchBlob.fs
      .readFile(filePath, 'base64')
      .then(data => {
        const formData = new FormData();
        formData.append('language', 'english');
        formData.append('model_size', 'tiny');
        formData.append('audio_data', {
          uri: Platform.OS === 'android' ? `file://${filePath}` : filePath,
          type: 'audio/wav',
          name: fileName,
        });

        axios({
          url: 'https://3f82-102-219-153-207.ngrok-free.app/transcribe',
          method: 'POST',
          data: formData,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'multipart/form-data',
          },
        })
          .then(function (response) {
            console.log('response :', response);
            setTranscribedData((oldData: any) => [...oldData, response.data]);
            setIsTranscribing(false);
            intervalRef.current = setInterval(
              transcribeInterim,
              transcribeTimeout * 1000,
            );
          })
          .catch(function (error) {
            console.log('error :', error);
          });
      })
      .catch(error => {
        console.log('Error reading file:', error);
      });
  };

  const resetTranscribedData = () => {
    setTranscribedData([]);
  };
  return (
    <SafeAreaView style={styles.main}>
      <Text style={styles.head}>
        Agora Interactive Live Streaming Quickstart
      </Text>
      <View style={styles.btnContainer}>
        <Text onPress={join} style={styles.button}>
          {isJoinLoading ? 'Joining...' : '  Join'}
        </Text>
        <Text onPress={leave} style={styles.button}>
          {isLeaveLoading ? 'Leaving...' : '  Leave'}
        </Text>
      </View>
      <View style={styles.btnContainer}>
        <Text>Audience</Text>
        <Switch
          onValueChange={switchValue => {
            setIsHost(switchValue);
            if (isJoined) {
              leave();
            }
          }}
          value={isHost}
        />
        <Text>Host</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContainer}>
        {isJoined && isHost ? (
          <React.Fragment key={0}>
            <RtcSurfaceView canvas={{uid: 0}} style={styles.videoView} />
            <Text>Local user uid: {uid}</Text>
          </React.Fragment>
        ) : (
          <Text>{isHost ? 'Join a channel' : ''}</Text>
        )}
        {isJoined && !isHost && remoteUid !== 0 ? (
          <React.Fragment key={remoteUid}>
            <RtcSurfaceView
              canvas={{uid: remoteUid}}
              style={styles.videoView}
            />
            <Text>Remote user uid: {remoteUid}</Text>
          </React.Fragment>
        ) : (
          <Text>
            {isJoined && !isHost ? 'Waiting for a remote user to join' : ''}
          </Text>
        )}
        <Text style={styles.info}>{message}</Text>
      </ScrollView>
      {isTranscribing && <ActivityIndicator size="large" color="#fff" />}
      <View style={styles.transcription}>
        <TranscribedOutput
          transcribedText={transcribedData}
          interimTranscribedText={interimTranscribedData}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  parent: {
    flex: 1,
  },
  container: {
    padding: 16,
    flex: 1,
  },
  transcription: {
    flex: 1,
    flexDirection: 'row',
  },
  fileHeader: {
    color: '#fff',
    fontSize: 30,
    marginBottom: 10,
    borderColor: '#ccc',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  list: {
    marginVertical: 5,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  listName: {
    fontSize: 16,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 10,
  },
  button: {
    paddingHorizontal: 25,
    paddingVertical: 4,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#0055cc',
    margin: 5,
  },
  main: {flex: 1, alignItems: 'center'},
  scroll: {flex: 1, backgroundColor: '#ddeeff', width: '100%'},
  scrollContainer: {alignItems: 'center'},
  videoView: {width: '90%', height: 200},
  btnContainer: {flexDirection: 'row', justifyContent: 'center'},
  head: {fontSize: 20},
  info: {backgroundColor: '#ffffe0', paddingHorizontal: 8, color: '#0000ff'},
});

export default App;
